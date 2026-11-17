/**
 * Unified document text extraction for RAG ingestion.
 *
 * Supported formats:
 *  - PDF        -> pdf-parse (handles text-based PDFs)
 *  - DOCX       -> mammoth (extracts body text from Word .docx)
 *  - TXT / MD   -> UTF-8 decode (with BOM stripping)
 *  - CSV        -> UTF-8 decode (kept as raw text for embedding)
 *  - HTML       -> lightweight tag stripping (extractTextFromHtml)
 *
 * Every export takes a Buffer + optional filename/mimetype hints and returns
 * a plain string of extracted text, or throws a descriptive error.
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { extractTextFromHtml } = require('./ingest');

const MAX_EXTRACT_CHARS = 5_000_000; // ~5M chars safety cap; chunker + embedder handle the rest

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function stripBom(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3);
  }
  return buf;
}

function toText(buf) {
  return stripBom(buf).toString('utf8');
}

/* ------------------------------------------------------------------ */
/* Format detectors                                                   */
/* ------------------------------------------------------------------ */

function isPdf(name, mime) {
  const n = (name || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  return (
    n.endsWith('.pdf') ||
    m === 'application/pdf' ||
    m === 'application/x-pdf' ||
    m === 'application/x-bzpdf' ||
    m === 'application/x-gzpdf' ||
    (m === 'application/octet-stream' && n.endsWith('.pdf'))
  );
}

function isDocx(name, mime) {
  const n = (name || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  return (
    n.endsWith('.docx') ||
    m ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    (m === 'application/zip' && n.endsWith('.docx'))
  );
}

function isDoc(name, mime) {
  const n = (name || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  return (
    n.endsWith('.doc') ||
    m === 'application/msword' ||
    (m === 'application/octet-stream' && n.endsWith('.doc'))
  );
}

function isText(name, mime) {
  const n = (name || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  return (
    n.endsWith('.txt') ||
    n.endsWith('.md') ||
    m === 'text/plain' ||
    m === 'text/markdown' ||
    m === 'text/x-markdown' ||
    m.startsWith('text/')
  );
}

function isCsv(name, mime) {
  const n = (name || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  return n.endsWith('.csv') || m === 'text/csv' || m === 'application/csv';
}

function isHtml(name, mime) {
  const n = (name || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  return (
    n.endsWith('.html') ||
    n.endsWith('.htm') ||
    m === 'text/html' ||
    m.startsWith('text/html')
  );
}

/* ------------------------------------------------------------------ */
/* Per-format extractors                                              */
/* ------------------------------------------------------------------ */

async function extractPdf(buf) {
  try {
    const parsed = await pdfParse(buf);
    return parsed.text || '';
  } catch (err) {
    throw Object.assign(
      new Error(
        'Could not read PDF. Make sure it is not password-protected, corrupted, or a scanned image PDF (image-only PDFs have no extractable text).',
      ),
      { status: 400 },
    );
  }
}

async function extractDocx(buf) {
  try {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value || '';
  } catch (err) {
    throw Object.assign(
      new Error('Could not read DOCX file. Make sure it is not corrupted.'),
      { status: 400 },
    );
  }
}

function extractPlain(buf) {
  return toText(buf);
}

function extractMarkdown(buf) {
  return toText(buf);
}

function extractCsv(buf) {
  // CSV is kept as raw text so the embedder can learn tabular content too.
  return toText(buf);
}

function extractHtml(buf) {
  return extractTextFromHtml(toText(buf));
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Extract human-readable text from an uploaded file buffer.
 *
 * @param {Buffer} buf          raw file bytes (from express-fileupload `file.data`)
 * @param {string} [name]       original filename (used for extension hints)
 * @param {string} [mime]       mime type from multipart upload (may be unreliable)
 * @returns {Promise<string>}   extracted text
 */
async function extractFileText(buf, name, mime) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw Object.assign(new Error('Uploaded file is empty or unreadable.'), {
      status: 400,
    });
  }

  let text = '';

  if (isPdf(name, mime)) {
    text = await extractPdf(buf);
  } else if (isDocx(name, mime)) {
    text = await extractDocx(buf);
  } else if (isDoc(name, mime)) {
    // Legacy .doc (binary Word) cannot be parsed without an external converter.
    throw Object.assign(
      new Error(
        '.doc files are not supported. Please save as .docx (Word 2007+) or .txt/.pdf and upload again.',
      ),
      { status: 400 },
    );
  } else if (isText(name, mime)) {
    text = extractPlain(buf);
  } else if (isMarkdown(name, mime)) {
    text = extractMarkdown(buf);
  } else if (isCsv(name, mime)) {
    text = extractCsv(buf);
  } else if (isHtml(name, mime)) {
    text = extractHtml(buf);
  } else {
    throw Object.assign(
      new Error(
        'Unsupported file type. Upload PDF, DOCX, TXT, MD, CSV or HTML.',
      ),
      { status: 400 },
    );
  }

  if (!text || text.trim().length < 20) {
    throw Object.assign(
      new Error(
        'Could not extract meaningful text from this file. It may be image-based, password-protected, or empty.',
      ),
      { status: 400 },
    );
  }

  // Safety cap so very large documents don't bloat the embedding/vector store.
  if (text.length > MAX_EXTRACT_CHARS) {
    text = text.slice(0, MAX_EXTRACT_CHARS);
  }

  return text;
}

/**
 * Convenience: validate text from manual paste input.
 */
function extractTextInput(text) {
  if (!text || text.trim().length < 20) {
    throw Object.assign(new Error('Please provide at least a sentence of content.'), {
      status: 400,
    });
  }
  return text.trim();
}

module.exports = {
  extractFileText,
  extractTextInput,
  extractPdf,
  extractDocx,
  extractPlain,
  extractMarkdown,
  extractCsv,
  extractHtml,
  isPdf,
  isDocx,
  isDoc,
  isText,
  isCsv,
  isHtml,
};