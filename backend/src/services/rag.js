const supabaseAdmin = require('../lib/supabase');
const { embedText } = require('./embeddings');
const config = require('../config');

/**
 * Ingest a document: chunk -> embed -> store sections.
 * Tenant-scoped: everything is filtered by organizationId.
 */
async function ingestDocument({ organizationId, title, sourceType, url, text }) {
  // Enforce free-tier document quota
  const { count } = await supabaseAdmin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (count >= config.freeTierQuotas.documentsMax) {
    throw Object.assign(new Error(`Free plan limit reached (${config.freeTierQuotas.documentsMax} documents). Upgrade to add more.`), { status: 402 });
  }

  const { data: doc, error: docErr } = await supabaseAdmin
    .from('documents')
    .insert({ organization_id: organizationId, title, source_type: sourceType, url, status: 'processing' })
    .select()
    .single();

  if (docErr) {
    console.error('[ingestDocument] insert failed:', docErr.message);
    const hint = /version|column/i.test(docErr.message || '')
      ? '\n\nFIX: Run this in Supabase SQL Editor:\n  alter table public.organizations add column if not exists version int not null default 0;\n  create or replace function public.bump_org_version() returns trigger language plpgsql as $$\nbegin\n  update public.organizations set version = version + 1 where id = coalesce(new.organization_id, old.organization_id);\n  return coalesce(new, old);\nend;\n$$;\ndrop trigger if exists documents_bump_version on public.documents;\ncreate trigger documents_bump_version after insert or update or delete on public.documents for each row execute function public.bump_org_version();'
      : '';
    throw Object.assign(new Error(`Document insert failed${hint}: ${docErr.message}`), { status: 400 });
  }

  try {
    const chunks = require('./ingest').chunkText(text);
    if (chunks.length === 0) throw new Error('No meaningful content extracted');

    const vectors = await require('./embeddings').embedBatch(chunks);

    const rows = chunks.map((content, i) => ({
      document_id: doc.id,
      organization_id: organizationId,
      content,
      embedding: vectors[i],
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabaseAdmin.from('document_sections').insert(rows.slice(i, i + 50));
      if (error) throw error;
    }

    await supabaseAdmin.from('documents').update({ status: 'ready' }).eq('id', doc.id);
    try {
      await trackUsage(organizationId, 'embedding', rows.length);
    } catch (usageErr) {
      console.warn('[ingestDocument] trackUsage failed (non-fatal):', usageErr.message);
    }

    return { documentId: doc.id, chunks: rows.length };
  } catch (err) {
    console.error('[ingestDocument] ingestion failed:', err.message, err.details || '', err.hint || '');
    await supabaseAdmin.from('documents').update({ status: 'failed' }).eq('id', doc.id);
    throw err;
  }
}

async function markDocumentFailed(organizationId, documentId) {
  const { error } = await supabaseAdmin
    .from('documents')
    .update({ status: 'failed' })
    .eq('id', documentId)
    .eq('organization_id', organizationId);
  if (error) console.error('markDocumentFailed:', error.message);
}

async function deleteDocument(organizationId, documentId) {
  const { error } = await supabaseAdmin
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', organizationId); // tenant guard
  if (error) throw error;
}

/**
 * Retrieve top-k relevant chunks for a query, scoped to tenant.
 */
async function retrieveContext(organizationId, query, topK = config.rag.topK) {
  if (!organizationId) {
    console.error("[retrieveContext] No organizationId provided");
    return [];
  }

  try {
    const embedding = await embedText(query);
    const { data, error } = await supabaseAdmin.rpc("match_document_sections", {
      query_embedding: embedding,
      match_count: topK,
      org_id: organizationId,
    });

    if (!error && data && data.length > 0) {
      // Filter by minimum similarity threshold (0.25 = reasonably relevant)
      const relevant = data.filter((c) => (c.similarity || 0) >= 0.25);
      if (relevant.length > 0) {
        console.log("[retrieveContext] Found " + relevant.length + " relevant chunks via vector search (filtered from " + data.length + ")");
        return relevant;
      }
      console.warn("[retrieveContext] Vector search returned results but none above similarity threshold");
    }

    if (error) {
      console.error("[retrieveContext] RPC error:", error.message);
    } else {
      console.warn("[retrieveContext] Vector search returned 0 results");
    }
  } catch (err) {
    console.error("[retrieveContext] Vector search failed:", err.message);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("document_sections")
      .select("id, document_id, content")
      .eq("organization_id", organizationId)
      .limit(topK * 3);

    if (error) {
      console.error("[retrieveContext] Text fallback query error:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn("[retrieveContext] No document_sections found for org:", organizationId);
      return [];
    }

    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const scored = data.map((row) => {
      const contentLower = (row.content || "").toLowerCase();
      const score = queryWords.reduce((s, w) => s + (contentLower.includes(w) ? 1 : 0), 0);
      return { ...row, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, topK).filter((r) => r.score > 0);

    if (results.length > 0) {
      console.log("[retrieveContext] Found " + results.length + " chunks via text fallback");
      return results;
    }

    console.warn("[retrieveContext] No keyword matches, returning first chunks as fallback");
    return data.slice(0, topK).map((r) => ({ ...r, similarity: 0.5 }));
  } catch (err) {
    console.error("[retrieveContext] Text fallback failed:", err.message);
    return [];
  }
}
async function trackUsage(organizationId, eventType, tokens = 0) {
  try {
    await supabaseAdmin
      .from('usage_events')
      .insert({ organization_id: organizationId, event_type: eventType, tokens });
  } catch (err) {
    console.warn('[trackUsage] failed (non-fatal):', err.message);
  }
}

/* --------------------------------------------------------------- */
/* Background crawl ingestion (used by the async /crawl route)      */
/* --------------------------------------------------------------- */

/** Quota check + placeholder row (status 'processing') created BEFORE the crawl starts. */
async function createPendingDocument({ organizationId, title, sourceType, url }) {
  const { count } = await supabaseAdmin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (count >= config.freeTierQuotas.documentsMax) {
    throw Object.assign(
      new Error(`Free plan limit reached (${config.freeTierQuotas.documentsMax} documents). Upgrade to add more.`),
      { status: 402 }
    );
  }

  const { data: doc, error: docErr } = await supabaseAdmin
    .from('documents')
    .insert({ organization_id: organizationId, title, source_type: sourceType, url, status: 'processing' })
    .select()
    .single();

  if (docErr) {
    const hint = /version|column/i.test(docErr.message || '')
      ? '\n\nFIX: Run the version-column migration in Supabase SQL Editor (see backend error log for the exact SQL).'
      : '';
    throw Object.assign(new Error(`Document insert failed${hint}: ${docErr.message}`), { status: 400 });
  }
  return doc;
}

/**
 * Chunk -> embed -> store into an EXISTING document row, with
 * source-attributed, per-section chunking when sections are provided:
 * each chunk gets a `Source: title (url)` prefix so retrieved passages
 * cite their page (the product promises "point back to the source").
 * Cross-page straddling is impossible — chunks never span two sections.
 */
async function ingestIntoDocument({ documentId, organizationId, title, sourceType, url, text, sections }) {
  try {
    let chunks;
    if (Array.isArray(sections) && sections.length > 0) {
      chunks = [];
      for (const s of sections) {
        const prefix = `Source: ${s.title || s.url} (${s.url})\n`;
        for (const c of require('./ingest').chunkText(s.text)) chunks.push(prefix + c);
      }
    } else {
      chunks = require('./ingest').chunkText(text);
    }
    if (chunks.length === 0) throw new Error('No meaningful content extracted');

    const vectors = await require('./embeddings').embedBatch(chunks);

    const rows = chunks.map((content, i) => ({
      document_id: documentId,
      organization_id: organizationId,
      content,
      embedding: vectors[i],
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabaseAdmin.from('document_sections').insert(rows.slice(i, i + 50));
      if (error) throw error;
    }

    await supabaseAdmin.from('documents').update({ status: 'ready' }).eq('id', documentId);
    try {
      await trackUsage(organizationId, 'embedding', rows.length);
    } catch (usageErr) {
      console.warn('[ingestIntoDocument] trackUsage failed (non-fatal):', usageErr.message);
    }

    return { documentId, chunks: rows.length };
  } catch (err) {
    console.error('[ingestIntoDocument] ingestion failed:', err.message, err.details || '', err.hint || '');
    await supabaseAdmin.from('documents').update({ status: 'failed' }).eq('id', documentId);
    throw err;
  }
}

module.exports = { ingestDocument, createPendingDocument, ingestIntoDocument, markDocumentFailed, deleteDocument, retrieveContext, trackUsage };
