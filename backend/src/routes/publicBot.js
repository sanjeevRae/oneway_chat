const express = require('express');
const supabaseAdmin = require('../lib/supabase');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Public Bot Page
|--------------------------------------------------------------------------
|
| External:
| https://onewaynepal.com/chat-api/bot/:orgId
|
*/

router.get('/bot/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return res.status(404).send('Business not found');
    }

    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('bot_name, welcome_message, brand_color')
      .eq('organization_id', orgId)
      .maybeSingle();

    const botName = settings?.bot_name || 'OneWay Bot';

    /*
      Brand colour from Settings, restricted to a plain hex value so it can be
      dropped straight into the stylesheet.
    */
    const brandColor =
      typeof settings?.brand_color === 'string' &&
      /^#[0-9a-fA-F]{3,8}$/.test(settings.brand_color.trim())
        ? settings.brand_color.trim()
        : '#6366f1';

    const safeBotName = String(botName)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const safeWelcome = String(
      settings?.welcome_message ||
        'Hi! How can I help you today?'
    )
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    res.setHeader(
      'Content-Type',
      'text/html; charset=utf-8'
    );

    res.send(`
<!DOCTYPE html>
<html lang="en">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>${safeBotName}</title>

  <style>

    :root {
      --brand: ${brandColor};
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
    }

    body {
      background: #eef0f4;
      color: #18181b;
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        Roboto,
        Arial,
        sans-serif;
    }

    .container {
      width: 100%;
      max-width: 760px;
      height: 100vh;
      height: 100dvh;
      margin: 0 auto;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 40px rgba(15, 23, 42, .08);
    }

    /* ---------- Header ---------- */

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      color: #ffffff;
      background: var(--brand);
      flex: none;
    }

    .avatar {
      width: 38px;
      height: 38px;
      flex: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, .22);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar svg {
      width: 20px;
      height: 20px;
    }

    .header-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      line-height: 1.2;
    }

    .header-title {
      font-size: 15.5px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-sub {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, .85);
    }

    .online-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, .3);
    }

    .messages {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 20px 16px;
      background: #f7f8fa;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
    }

    /*
      width: fit-content is the important bit: without it a block-level bubble
      always stretched to max-width, so even "Hi" rendered as a full-width bar.
      Now the bubble hugs its text and only wraps once it hits the cap.
    */
    .message {
      width: fit-content;
      max-width: min(82%, 30rem);
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 14.5px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      animation: bubble-in .18s ease-out;
    }

    @keyframes bubble-in {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    .bot {
      align-self: flex-start;
      background: #ffffff;
      border: 1px solid #e6e8ee;
      color: #27272a;
      border-bottom-left-radius: 6px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
    }

    .user {
      align-self: flex-end;
      background: var(--brand);
      color: #ffffff;
      border-bottom-right-radius: 6px;
    }

    /* ---------- Typing indicator ---------- */

    .typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 14px;
      width: fit-content;
    }

    .typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #a1a1aa;
      animation: typing-bounce 1s infinite;
    }

    .typing span:nth-child(2) {
      animation-delay: .15s;
    }

    .typing span:nth-child(3) {
      animation-delay: .3s;
    }

    @keyframes typing-bounce {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: .55;
      }
      30% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }

    .input-area {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #e6e8ee;
      background: #ffffff;
      flex: none;
    }

    input {
      flex: 1;
      min-width: 0;
      padding: 12px 16px;
      border: 1px solid #d8dbe3;
      border-radius: 22px;
      font-size: 15px;
      font-family: inherit;
      background: #fafbfc;
      outline: none;
      transition: border-color .15s, background .15s;
    }

    input:focus {
      border-color: var(--brand);
      background: #ffffff;
    }

    button {
      flex: none;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 50%;
      color: #ffffff;
      background: var(--brand);
      cursor: pointer;
      transition: opacity .15s, transform .15s;
    }

    button:hover:not(:disabled) {
      transform: scale(1.05);
    }

    button:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    button svg {
      width: 19px;
      height: 19px;
    }

    /* ---------- Footer note ---------- */

    .footer {
      margin: 0;
      padding: 0 12px 10px;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
      background: #ffffff;
      flex: none;
    }

    /* ---------- Mobile ---------- */

    @media (max-width: 480px) {

      .messages {
        padding: 16px 12px;
      }

      .message {
        max-width: 88%;
      }
    }

  </style>

</head>

<body data-bot-welcome="${safeWelcome}">

  <div class="container">

    <header class="header">

      <div class="avatar" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105" />
        </svg>
      </div>

      <div class="header-text">

        <span class="header-title">
          ${safeBotName}
        </span>

        <span class="header-sub">
          <span class="online-dot"></span>
          Online &middot; replies instantly
        </span>

      </div>

    </header>

    <div
      id="messages"
      class="messages"
    ></div>

    <div class="input-area">

      <input
        id="input"
        type="text"
        placeholder="Type your message..."
        autocomplete="off"
        aria-label="Message"
      >

      <button
        id="send"
        type="button"
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      </button>

    </div>

    <p class="footer">Powered by OneWayChat</p>

  </div>

  <!--
    IMPORTANT:
    JavaScript is loaded externally so Helmet's
    Content Security Policy allows it.
  -->

  <script
    src="/chat-api/public-bot.js?org=${encodeURIComponent(orgId)}"
    defer
  ></script>

</body>

</html>
    `);

  } catch (err) {

    console.error('Public bot error:', err);

    res.status(500).send(
      'Internal server error'
    );

  }
});

module.exports = router;