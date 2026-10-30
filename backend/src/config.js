require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY, // server-only
    anonKey: process.env.SUPABASE_ANON_KEY,
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  },

  // Fallback LLM provider (used when Groq is down or rate-limited)
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
  },

  // Cloudflare Turnstile (bot protection — free, unlimited)
  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY || '',
    // When empty, verification is skipped (dev mode / not yet configured)
  },

  // Embeddings: local MiniLM via HuggingFace Inference API (free) or fallback hash
  embeddings: {
    hfToken: process.env.HUGGINGFACE_API_KEY || '',
    hfModel: process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    dimensions: 384,
  },

  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  freeTierQuotas: {
    messagesPerMonth: parseInt(process.env.QUOTA_MESSAGES_PER_MONTH || '200', 10),
    documentsMax: parseInt(process.env.QUOTA_DOCUMENTS_MAX || '10', 10),
    bookingsPerMonth: parseInt(process.env.QUOTA_BOOKINGS_PER_MONTH || '50', 10),
  },

  rag: {
    chunkSize: 400,   // tokens approx
    chunkOverlap: 50,
    topK: 5,
  },

  // Website crawler settings — all overridable via environment variables.
  crawler: {
    maxPages: parseInt(process.env.CRAWLER_MAX_PAGES || '100', 10),
    concurrency: parseInt(process.env.CRAWLER_CONCURRENCY || '15', 10),
    perPageTimeoutMs: parseInt(process.env.CRAWLER_PER_PAGE_TIMEOUT_MS || '8000', 10),
    discoverDeadlineMs: parseInt(process.env.CRAWLER_DISCOVER_DEADLINE_MS || '30000', 10),
    auxTimeoutMs: parseInt(process.env.CRAWLER_AUX_TIMEOUT_MS || '5000', 10),
    maxRedirects: parseInt(process.env.CRAWLER_MAX_REDIRECTS || '5', 10),
    maxHtmlBytes: parseInt(process.env.CRAWLER_MAX_HTML_BYTES || String(2.5 * 1024 * 1024), 10),
    maxPageChars: parseInt(process.env.CRAWLER_MAX_PAGE_CHARS || '20000', 10),
    maxTotalChars: parseInt(process.env.CRAWLER_MAX_TOTAL_CHARS || '500000', 10),
    minPageChars: parseInt(process.env.CRAWLER_MIN_PAGE_CHARS || '60', 10),
    maxRetries: parseInt(process.env.CRAWLER_MAX_RETRIES || '2', 10),
    retryBaseDelayMs: parseInt(process.env.CRAWLER_RETRY_BASE_DELAY_MS || '500', 10),
  },
};

module.exports = config;
