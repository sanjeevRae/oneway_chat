const express = require('express');
const supabaseAdmin = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { ingestDocument, deleteDocument, trackUsage, createPendingDocument, ingestIntoDocument, markDocumentFailed } = require('../services/rag');
const { crawlSite } = require('../services/crawler');
const { importGoogleDrive, importNotion } = require('../services/imports');

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

/** POST /api/knowledge/upload — file upload (txt/md/pdf) */
router.post('/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded (field name: "file")' });
    }
    const file = req.files.file;

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (max 5MB on free plan)' });
    }

    let text = '';
    if (file.mimetype === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const pdf = await pdfParse(file.data);
      text = pdf.text;
    } else if (/^text\/|json|markdown|csv/.test(file.mimetype) || /\.(txt|md|csv|json)$/i.test(file.name)) {
      text = file.data.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Use PDF, TXT, MD or CSV.' });
    }

    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Could not extract text from file' });
    }

    const result = await ingestDocument({
      organizationId: req.orgId,
      title: file.name,
      sourceType: 'upload',
      text,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
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
