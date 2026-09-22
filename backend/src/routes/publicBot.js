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
      background: #f5f5f5;
      font-family: Arial, sans-serif;
    }

    .container {
      width: 100%;
      max-width: 760px;
      height: 100vh;
      margin: 0 auto;
      background: #ffffff;
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 18px;
      color: #ffffff;
      background: #6366f1;
      font-size: 20px;
      font-weight: 700;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .message {
      max-width: 80%;
      padding: 12px 14px;
      margin-bottom: 12px;
      border-radius: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .bot {
      background: #f0f0f0;
      color: #222222;
    }

    .user {
      margin-left: auto;
      background: #6366f1;
      color: #ffffff;
    }

    .input-area {
      display: flex;
      padding: 12px;
      border-top: 1px solid #dddddd;
      background: #ffffff;
    }

    input {
      flex: 1;
      min-width: 0;
      padding: 12px;
      border: 1px solid #dddddd;
      border-radius: 10px;
      font-size: 16px;
      outline: none;
    }

    input:focus {
      border-color: #6366f1;
    }

    button {
      margin-left: 8px;
      padding: 0 20px;
      border: 0;
      border-radius: 10px;
      color: #ffffff;
      background: #6366f1;
      cursor: pointer;
      font-size: 15px;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

  </style>

</head>

<body data-bot-welcome="${safeWelcome}">

  <div class="container">

    <div class="header">
      ${safeBotName}
    </div>

    <div
      id="messages"
      class="messages"
    ></div>

    <div class="input-area">

      <input
        id="input"
        type="text"
        placeholder="Type a message..."
        autocomplete="off"
      >

      <button
        id="send"
        type="button"
      >
        Send
      </button>

    </div>

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