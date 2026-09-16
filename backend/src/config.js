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
};

module.exports = config;
