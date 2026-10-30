const config = require('../config');

/**
 * Chunk text into semantically coherent windows.
 * Uses sentence-boundary aware chunking with overlap for better RAG quality.
 */
function chunkText(text, chunkSize = config.rag.chunkSize, overlap = config.rag.chunkOverlap) {
  if (!text || text.trim().length === 0) return [];

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Split into sentences (handle common abbreviations and punctuation)
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return [];

  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;

    // If adding this sentence would exceed chunk size, finalize current chunk
    if (currentWordCount + sentenceWords > chunkSize && currentChunk.length > 0) {
      const chunk = currentChunk.join(' ');
      if (chunk.length > 20) chunks.push(chunk);

      // Overlap: keep last few sentences for context continuity
      const overlapWords = Math.min(overlap, Math.floor(currentWordCount * 0.3));
      let overlapCount = 0;
      const overlapSentences = [];
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const w = currentChunk[i].split(/\s+/).length;
        if (overlapCount + w > overlapWords) break;
        overlapCount += w;
        overlapSentences.unshift(currentChunk[i]);
      }
      currentChunk = overlapSentences;
      currentWordCount = overlapCount;
    }

    currentChunk.push(sentence);
    currentWordCount += sentenceWords;
  }

  // Finalize last chunk
  if (currentChunk.length > 0) {
    const chunk = currentChunk.join(' ');
    if (chunk.length > 20) chunks.push(chunk);
  }

  // Deduplicate near-identical chunks
  const seen = new Set();
  return chunks.filter((c) => {
    const key = c.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extract readable text from raw HTML (for website crawling).
 */
function extractTextFromHtml(html) {
  // Lightweight extraction without heavy deps
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extract human-readable copy from a JS bundle (SPA fallback).
 * Client-rendered sites keep their text inside string literals in the bundle.
 * Heuristics: length, letter ratio, no code punctuation at the start,
 * and must look like sentences (spaces + common words).
 */
function extractTextFromJsBundle(js) {
  const raw = js.match(/["'](?:[^"'\\]|\\.){40,800}["']/g) || [];
  const seen = new Set();
  const out = [];

  for (const s of raw) {
    const body = s.slice(1, -1);
    // Skip obvious code / config / paths
    if (/[{}();=<>]|=>|\bfunction\b|\bvar\b|\breturn\b|^https?:|^\/|\\n|\\u/.test(body)) continue;
    // Skip framework/dev noise
    if (/React has blocked|minified|dev environment|frame rate|npmjs\.com|error boundary/i.test(body)) continue;
    // Must be mostly letters/spaces and contain multiple words
    const letters = (body.match(/[A-Za-z]/g) || []).length;
    if (letters / body.length < 0.7) continue;
    const words = body.split(/\s+/);
    if (words.length < 6) continue;
    // Must read like prose: contains " the ", " and ", or similar glue
    if (!/\b(the|and|for|with|your|our|we|is|are|to|of|a)\b/i.test(body)) continue;

    const key = body.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(body.trim());
  }
  return out.join('\n\n');
}

/**
 * Fetch a URL and return extracted text.
 * Handles both server-rendered pages and client-side SPAs:
 *  - If the HTML has little text but references JS bundles, pull the main
 *    bundle(s) and extract readable copy from them.
 */
async function crawlUrl(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'OneWayChatAI-Bot/1.0 (+https://OneWayChat.ai)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();

  let text = extractTextFromHtml(html);

  // SPA detection: tiny extracted text + module scripts present
  if (text.length < 200) {
    const bundlePaths = [...html.matchAll(/<script[^>]+src="(\/[^"]+\.js)"/g)]
      .map((m) => m[1])
      .filter((p) => !/widget|analytics|gtag|facebook|hotjar/i.test(p))
      .slice(0, 3); // cap to avoid heavy fetching

    const origin = new URL(url).origin;
    for (const path of bundlePaths) {
      try {
        const bRes = await fetch(origin + path, { signal: AbortSignal.timeout(15000) });
        if (!bRes.ok) continue;
        const js = await bRes.text();
        const bundleText = extractTextFromJsBundle(js);
        if (bundleText.length > text.length) text = bundleText;
        if (text.length >= 500) break; // good enough
      } catch { /* try next bundle */ }
    }

    // Last resort: meta description often carries a solid summary on SPAs
    if (text.length < 100) {
      const desc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
        || html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
      if (desc?.[1]) text = (text ? text + '\n\n' : '') + desc[1];
    }
  }

  return text;
}

module.exports = { chunkText, extractTextFromHtml, crawlUrl };
