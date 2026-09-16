const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const fileUpload = require('express-fileupload');

const config = require('./config');
const { apiLimiter, chatLimiter } = require('./middleware/rateLimit');
const { verifyTurnstile } = require('./middleware/turnstile');

const app = express();

/*
|--------------------------------------------------------------------------
| Passenger /chat-api prefix handling
|--------------------------------------------------------------------------
|
| Passenger receives:
|   /chat-api/health
|   /chat-api/api/chat
|   /chat-api/widget.js
|   /chat-api/bot/:orgId
|
| Express should internally see:
|   /health
|   /api/chat
|   /widget.js
|   /bot/:orgId
|
*/

app.use((req, res, next) => {
  if (req.url.startsWith('/chat-api')) {
    req.url = req.url.slice('/chat-api'.length) || '/';
  }

  next();
});

/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.use(helmet());

/*
|--------------------------------------------------------------------------
| Request body
|--------------------------------------------------------------------------
*/

app.use(express.json({
  limit: '2mb'
}));

/*
|--------------------------------------------------------------------------
| File uploads
|--------------------------------------------------------------------------
*/

app.use(fileUpload({
  limits: {
    fileSize: 6 * 1024 * 1024
  }
}));

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| Public chatbot requests must work from customer websites.
|
*/

const publicCors = cors({
  origin: true,
  credentials: false
});

/*
|--------------------------------------------------------------------------
| CORS configuration for authenticated/dashboard APIs
|--------------------------------------------------------------------------
*/

const corsOriginMatchers = config.corsOrigins.map((o) =>
  o.includes('*')
    ? new RegExp(
        `^${o
          .split('*')
          .map((s) =>
            s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          )
          .join('.*')}$`,
        'i'
      )
    : o
);

const strictCors = cors({
  credentials: true,

  origin: config.corsOrigins.includes('*')
    ? true
    : corsOriginMatchers
});

/*
|--------------------------------------------------------------------------
| Public Chat CORS
|--------------------------------------------------------------------------
|
| The embeddable widget can be installed on other websites.
|
*/

app.use('/api/chat', publicCors);

/*
|--------------------------------------------------------------------------
| General CORS
|--------------------------------------------------------------------------
*/

app.use(strictCors);

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
|
| External:
|   https://onewaynepal.com/chat-api/health
|
*/

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'onewaybot-backend',
    time: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| Public Chat API
|--------------------------------------------------------------------------
|
| External:
|   POST /chat-api/api/chat
|
| Body:
| {
|   orgId,
|   sessionId,
|   message,
|   channel
| }
|
*/

app.use(
  '/api/chat',
  chatLimiter,
  verifyTurnstile,
  require('./routes/chat')
);

/*
|--------------------------------------------------------------------------
| Authenticated API Routes
|--------------------------------------------------------------------------
*/

app.use(
  '/api/knowledge',
  require('./routes/knowledge')
);

app.use(
  '/api/bookings',
  require('./routes/bookings')
);

app.use(
  '/api/leads',
  require('./routes/leads')
);

app.use(
  '/api/analytics',
  require('./routes/analytics')
);

app.use(
  '/api/org',
  require('./routes/org')
);

app.use(
  '/api/inbox',
  require('./routes/inbox')
);

app.use(
  '/api/admin',
  require('./routes/admin')
);

/*
|--------------------------------------------------------------------------
| Public Bot Page
|--------------------------------------------------------------------------
|
| External:
|
|   https://onewaynepal.com/chat-api/bot/:orgId
|
| Example:
|
|   https://onewaynepal.com/chat-api/bot/e73e3b3b-220a-4382-81e0-cef2ea63ded5
|
*/

app.use(
  require('./routes/publicBot')
);

/*
|--------------------------------------------------------------------------
| Public Static Files
|--------------------------------------------------------------------------
|
| This serves:
|
|   backend/public/widget.js
|   backend/public/logo.webp
|
| External:
|
|   /chat-api/widget.js
|   /chat-api/logo.webp
|
*/

app.use(
  express.static(
    path.join(__dirname, '..', 'public')
  )
);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found'
  });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error'
  });
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(
  config.port,
  '0.0.0.0',
  () => {
    console.log(
      `OneWay Bot backend running on port ${config.port} (${config.env})`
    );
  }
);