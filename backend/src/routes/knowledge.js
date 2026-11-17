const express = require('express');
const supabaseAdmin = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { ingestDocument, deleteDocument, trackUsage, createPendingDocument, ingestIntoDocument, markDocumentFailed } = require('../services/rag');
const { crawlSite } = require('../services/crawler');
const { importGoogleDrive, importNotion } = require('../services/imports');
const { extractFileText, extractTextInput } = require('../services/extract');

const router = express.Router();
router.use(requireAuth);

/** GET /api/knowledge — list tenant documents */
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, title, source_type, url, status, created_at')
    .eq('organization_id', req.orgId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ documents: data || [] });
});

/** GET /api/knowledge/status — diagnostic: KB health for the current org */
router.get('/status', async (req, res) => {
  try {
    const { data: docs, error: docsErr } = await supabaseAdmin
      .from('documents')
      .select('id, title, source_type, status')
      .eq('organization_id', req.orgId);

    if (docsErr) throw docsErr;

    const ready = docs.filter((d) => d.status === 'ready').length;
    const processing = docs.filter((d) => d.status === 'processing').length;
    const failed = docs.filter((d) => d.status === 'failed').length;

    // Check if the version column exists (quick probe)
    const { error: versionErr } = await supabaseAdmin
      .from('organizations')
      .select('version')
      .eq('id', req.orgId)
      .single();

    const versionColumnMissing = versionErr && /version|column/i.test(versionErr.message || '');

    res.json({
      organizationId: req.orgId,
      totalDocuments: docs.length,
      ready,
      processing,
      failed,
      versionColumnMissing,
      kbEmpty: ready === 0,
      hint: versionColumnMissing
        ? 'Run the version-column migration in Supabase SQL Editor (see backend console for exact SQL).'
        : ready === 0
          ? 'No ready documents. Upload a file or crawl a website to build your knowledge base.'
          : 'Knowledge base looks healthy.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/knowledge/crawl — crawl a website (sitemap + links) and learn it */
router.post('/crawl', async (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    let parsed;
    try { parsed = new URL(normalized); } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only http(s) URLs can be crawled' });
    }
    normalized = parsed.href;

    /*
      Deep crawls (40 pages, sitemaps, structured data) plus embedding can
      take 30s+. The pending row is created synchronously so quota is
      enforced up-front, then the crawl runs in the background and the
      Train list polls the document status until it flips to
      'ready' / 'failed'.
    */
    const doc = await createPendingDocument({
      organizationId: req.orgId,
      title: title || parsed.hostname,
      sourceType: 'crawl',
      url: normalized,
    });

    res.json({ ok: true, status: 'processing', documentId: doc.id });

    (async () => {
      try {
        const crawl = await crawlSite(normalized);
        if (!crawl.text || crawl.text.length < 50) {
          throw new Error('Found the site but no readable content on its pages');
        }
        await ingestIntoDocument({
          documentId: doc.id,
          organizationId: req.orgId,
          text: crawl.text,
          sections: crawl.sections,
        });
        await trackUsage(req.orgId, 'crawl', crawl.pages);
        console.log(`[Crawl] Learned ${crawl.pages} page(s) from ${parsed.hostname} into doc ${doc.id}`);
      } catch (err) {
        console.error(`[Crawl] Failed for ${normalized}:`, err.message);
        await markDocumentFailed(req.orgId, doc.id);
      }
    })();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/knowledge/text — manual entry / paste FAQs */
router.post('/text', async (req, res) => {
  try {
    const { title, text } = req.body;
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Please provide at least a sentence of content' });
    }
    const result = await ingestDocument({
      organizationId: req.orgId,
      title: title || 'Manual notes',
      sourceType: 'manual',
      text,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/knowledge/upload — file upload (pdf/docx/txt/md/csv/html) */
router.post('/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded (field name: "file")' });
    }
    const file = req.files.file;

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (max 5MB on free plan)' });
    }

    let text;
    try {
      text = await extractFileText(file.data, file.name, file.mimetype);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const result = await ingestDocument({
      organizationId: req.orgId,
      title: file.name,
      sourceType: 'upload',
      text,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Upload] error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/knowledge/drive — import a shared Google Drive file */
router.post('/drive', async (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const result = await importGoogleDrive({ organizationId: req.orgId, url, title });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/knowledge/notion — import a publicly shared Notion page */
router.post('/notion', async (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const result = await importNotion({ organizationId: req.orgId, url, title });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** DELETE /api/knowledge/:id */
router.delete('/:id', async (req, res) => {
  try {
    await deleteDocument(req.orgId, parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


