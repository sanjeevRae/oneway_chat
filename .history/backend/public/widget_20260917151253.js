(function () {
  'use strict';

  const script = document.currentScript;

  if (!script) {
    console.error('OneWay Bot: Could not find widget script.');
    return;
  }

  const url = new URL(script.src);
  const orgId = url.searchParams.get('org');

  if (!orgId) {
    console.error('OneWay Bot: Missing org parameter.');
    return;
  }

  const API_BASE = url.origin + '/chat-api';



  const sessionKey = 'onewaybot_session_' + orgId;

  let sessionId = localStorage.getItem(sessionKey);

  if (!sessionId) {
    sessionId =
      window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : 'session_' +
          Date.now() +
          '_' +
          Math.random().toString(36).slice(2);

    localStorage.setItem(sessionKey, sessionId);
  }

  /* =========================
     STYLES
  ========================= */

  const style = document.createElement('style');

  style.textContent = `
    #onewaybot-button {
      position: fixed;
      right: 20px;
      bottom: 20px;

      width: 60px;
      height: 60px;

      border: 0;
      border-radius: 50%;

      background: #ffffff;

      cursor: pointer;

      z-index: 2147483646;

      box-shadow: 0 8px 30px rgba(0, 0, 0, .25);

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 8px;

      overflow: hidden;
    }

    #onewaybot-button img {
      width: 100%;
      height: 100%;

      object-fit: contain;

      border-radius: 50%;
    }

    #onewaybot-window {
      position: fixed;

      right: 20px;
      bottom: 90px;

      width: 360px;
      height: 520px;

      background: #ffffff;

      border-radius: 16px;

      overflow: hidden;

      box-shadow: 0 10px 40px rgba(0, 0, 0, .25);

      display: none;
      flex-direction: column;

      z-index: 2147483647;

      font-family:
        Arial,
        Helvetica,
        sans-serif;
    }

    /* =========================
       HEADER
    ========================= */

    #onewaybot-header {
      padding: 15px 16px;

      background: #6366f1;

      color: #ffffff;

      font-weight: 600;

      display: flex;

      justify-content: space-between;
      align-items: center;
    }

    #onewaybot-close {
      background: transparent;

      border: 0;

      color: #ffffff;

      font-size: 18px;

      font-weight: 600;

      cursor: pointer;

      padding: 2px 6px;

      line-height: 1;
    }

    /* =========================
       MESSAGES AREA
    ========================= */

    #onewaybot-messages {
      flex: 1;

      overflow-y: auto;

      padding: 14px;

      background: #f7f7f7;

      display: flex;
      flex-direction: column;
    }

    /* =========================
       MESSAGE BUBBLE
    ========================= */

    .onewaybot-message {
      max-width: 82%;

      padding: 9px 11px;

      margin: 0 0 8px 0;

      border-radius: 12px;

      line-height: 1.4;

      font-size: 14px;

      word-break: break-word;

      overflow-wrap: anywhere;
    }

    .onewaybot-message:last-child {
      margin-bottom: 0;
    }

    /* USER */

    .onewaybot-user {
      margin-left: auto;
      margin-right: 0;

      background: #6366f1;

      color: #ffffff;

      border-bottom-right-radius: 3px;

      white-space: pre-wrap;
    }

    /* BOT */

    .onewaybot-bot {
      margin-left: 0;
      margin-right: auto;

      background: #ffffff;

      color: #222222;

      border: 1px solid #eeeeee;

      border-bottom-left-radius: 3px;
    }

    /* =========================
       MARKDOWN
    ========================= */

    .onewaybot-bot p {
      margin: 0 0 5px 0;

      padding: 0;
    }

    .onewaybot-bot p:last-child {
      margin-bottom: 0;
    }

    .onewaybot-bot strong {
      font-weight: 700;
    }

    .onewaybot-bot em {
      font-style: italic;
    }

    /* HEADINGS */

    .onewaybot-bot h1,
    .onewaybot-bot h2,
    .onewaybot-bot h3 {
      margin: 6px 0 4px 0;

      padding: 0;

      line-height: 1.3;
    }

    .onewaybot-bot h1 {
      font-size: 19px;
    }

    .onewaybot-bot h2 {
      font-size: 17px;
    }

    .onewaybot-bot h3 {
      font-size: 15px;
    }

    /* LISTS */

    .onewaybot-bot ul,
    .onewaybot-bot ol {
      margin: 3px 0 5px 18px;

      padding: 0;
    }

    .onewaybot-bot li {
      margin: 0 0 2px 0;

      padding: 0;
    }

    /* LINKS */

    .onewaybot-bot a {
      color: #4f46e5;

      text-decoration: underline;
    }

    /* INLINE CODE */

    .onewaybot-bot code {
      background: #f1f1f1;

      padding: 2px 5px;

      border-radius: 4px;

      font-size: 13px;
    }

    /* CODE BLOCK */

    .onewaybot-bot pre {
      background: #18181b;

      color: #ffffff;

      padding: 9px;

      margin: 5px 0;

      border-radius: 8px;

      overflow-x: auto;

      font-size: 12px;

      line-height: 1.4;
    }

    .onewaybot-bot pre code {
      background: transparent;

      padding: 0;

      color: inherit;
    }

    /* BLOCKQUOTE */

    .onewaybot-bot blockquote {
      margin: 5px 0;

      padding-left: 9px;

      border-left: 3px solid #6366f1;

      color: #555555;
    }

    /* =========================
       INPUT
    ========================= */

    #onewaybot-input-area {
      display: flex;

      padding: 9px;

      border-top: 1px solid #dddddd;

      background: #ffffff;
    }

    #onewaybot-input {
      flex: 1;

      min-width: 0;

      border: 1px solid #dddddd;

      border-radius: 10px;

      padding: 9px 10px;

      outline: none;

      font-size: 14px;

      font-family: inherit;
    }

    #onewaybot-input:focus {
      border-color: #6366f1;
    }

    #onewaybot-send {
      margin-left: 7px;

      border: 0;

      border-radius: 10px;

      padding: 0 15px;

      background: #6366f1;

      color: #ffffff;

      cursor: pointer;

      font-size: 14px;
    }

    #onewaybot-send:disabled {
      opacity: .6;

      cursor: not-allowed;
    }

    /* =========================
       MOBILE
    ========================= */

    @media (max-width: 480px) {

      #onewaybot-window {
        right: 10px;
        left: 10px;

        bottom: 80px;

        width: auto;

        height: 70vh;
      }

      #onewaybot-button {
        right: 15px;
        bottom: 15px;
      }
    }
  `;

  document.head.appendChild(style);

  /* =========================
     BUTTON
  ========================= */

  const button = document.createElement('button');

  button.id = 'onewaybot-button';

  button.setAttribute(
    'aria-label',
    'Open chat'
  );

  const logo = document.createElement('img');

  logo.src =
    'https://onewaynepal.com/chat-api/logo.webp';

  logo.alt = 'OneWay Bot';

  button.appendChild(logo);

  /* =========================
     CHAT WINDOW
  ========================= */

  const chat = document.createElement('div');

  chat.id = 'onewaybot-window';

  chat.innerHTML = `
    <div id="onewaybot-header">

      <span>OneWay Bot</span>

      <button
        id="onewaybot-close"
        aria-label="Close chat"
      >X</button>

    </div>

    <div id="onewaybot-messages"></div>

    <div id="onewaybot-input-area">

      <input
        id="onewaybot-input"
        type="text"
        placeholder="Type a message..."
        autocomplete="off"
      />

      <button id="onewaybot-send">
        Send
      </button>

    </div>
  `;

  document.body.appendChild(button);
  document.body.appendChild(chat);

  const messages =
    document.getElementById(
      'onewaybot-messages'
    );

  const input =
    document.getElementById(
      'onewaybot-input'
    );

  const send =
    document.getElementById(
      'onewaybot-send'
    );

  const close =
    document.getElementById(
      'onewaybot-close'
    );

  /* =========================
     ESCAPE HTML
  ========================= */

  function escapeHtml(text) {

    const div =
      document.createElement('div');

    div.textContent = text;

    return div.innerHTML;
  }

  /* =========================
     MARKDOWN RENDERER
  ========================= */

  function renderMarkdown(text) {

    if (!text) {
      return '';
    }

    let source = String(text);

    /*
      Normalize line endings.
    */

    source = source.replace(
      /\r\n/g,
      '\n'
    );

    source = source.replace(
      /\r/g,
      '\n'
    );

    /*
      Remove excessive blank lines.

      3+ newlines become only
      one blank line.
    */

    source = source.replace(
      /\n{3,}/g,
      '\n\n'
    );

    let html =
      escapeHtml(source);

    /*
      CODE BLOCKS
    */

    html = html.replace(
      /```([\s\S]*?)```/g,
      '<pre><code>$1</code></pre>'
    );

    /*
      INLINE CODE
    */

    html = html.replace(
      /`([^`\n]+)`/g,
      '<code>$1</code>'
    );

    /*
      BOLD
    */

    html = html.replace(
      /\*\*(.+?)\*\*/g,
      '<strong>$1</strong>'
    );

    html = html.replace(
      /__(.+?)__/g,
      '<strong>$1</strong>'
    );

    /*
      ITALIC
    */

    html = html.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    html = html.replace(
      /(?<!_)_([^_\n]+)_(?!_)/g,
      '<em>$1</em>'
    );

    /*
      HEADINGS
    */

    html = html.replace(
      /^### (.+)$/gm,
      '<h3>$1</h3>'
    );

    html = html.replace(
      /^## (.+)$/gm,
      '<h2>$1</h2>'
    );

    html = html.replace(
      /^# (.+)$/gm,
      '<h1>$1</h1>'
    );

    /*
      LINKS
    */

    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    /*
      BULLET LISTS

      Convert consecutive bullet
      lines into one UL.
    */

    const lines =
      html.split('\n');

    const output = [];

    let inList = false;
    let listType = null;

    function closeList() {

      if (!inList) {
        return;
      }

      output.push(
        listType === 'ol'
          ? '</ol>'
          : '</ul>'
      );

      inList = false;
      listType = null;
    }

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {

      let line =
        lines[i].trim();

      /*
        Completely empty lines.

        Ignore them instead of
        creating huge gaps.
      */

      if (!line) {

        closeList();

        continue;
      }

      /*
        Unordered list
      */

      const unordered =
        line.match(
          /^[-*+]\s+(.+)$/
        );

      if (unordered) {

        if (
          !inList ||
          listType !== 'ul'
        ) {

          closeList();

          output.push('<ul>');

          inList = true;

          listType = 'ul';
        }

        output.push(
          '<li>' +
          unordered[1] +
          '</li>'
        );

        continue;
      }

      /*
        Ordered list
      */

      const ordered =
        line.match(
          /^\d+\.\s+(.+)$/
        );

      if (ordered) {

        if (
          !inList ||
          listType !== 'ol'
        ) {

          closeList();

          output.push('<ol>');

          inList = true;

          listType = 'ol';
        }

        output.push(
          '<li>' +
          ordered[1] +
          '</li>'
        );

        continue;
      }

      /*
        Close list before
        normal content.
      */

      closeList();

      /*
        Blockquote
      */

      if (
        line.startsWith('&gt; ')
      ) {

        output.push(
          '<blockquote>' +
          line.substring(6) +
          '</blockquote>'
        );

        continue;
      }

      /*
        Already-rendered HTML
      */

      if (
        line.startsWith('<h1>') ||
        line.startsWith('<h2>') ||
        line.startsWith('<h3>') ||
        line.startsWith('<pre>') ||
        line.startsWith('<blockquote>')
      ) {

        output.push(line);

        continue;
      }

      /*
        Normal paragraph.

        Only ONE paragraph element.
      */

      output.push(
        '<p>' +
        line +
        '</p>'
      );
    }

    closeList();

    return output.join('');
  }

  /* =========================
     ADD MESSAGE
  ========================= */

  function addMessage(
    text,
    type
  ) {

    const div =
      document.createElement('div');

    div.className =
      'onewaybot-message ' +
      (
        type === 'user'
          ? 'onewaybot-user'
          : 'onewaybot-bot'
      );

    /*
      USER MESSAGE

      Keep exactly the user's text.
      No Markdown rendering.
      No generated paragraphs.
    */

    if (type === 'user') {

      div.textContent =
        String(text || '');

    }

    /*
      BOT MESSAGE

      Render Markdown.
    */

    else {

      div.innerHTML =
        renderMarkdown(text);
    }

    messages.appendChild(div);

    messages.scrollTop =
      messages.scrollHeight;

    return div;
  }

  /* =========================
     OPEN CHAT
  ========================= */

  function openChat() {

    chat.style.display = 'flex';

    if (
      !messages.dataset.welcome
    ) {

      messages.dataset.welcome = '1';

      addMessage(
        'Hi! How can I help you today?',
        'bot'
      );
    }

    input.focus();
  }

  /* =========================
     CLOSE CHAT
  ========================= */

  function closeChat() {

    chat.style.display = 'none';
  }

  /* =========================
     SEND MESSAGE
  ========================= */

  async function sendMessage() {

    const message =
      input.value.trim();

    if (!message) {
      return;
    }

    /*
      Clear input immediately.
    */

    input.value = '';

    send.disabled = true;

    input.disabled = true;

    /*
      User message.
    */

    addMessage(
      message,
      'user'
    );

    /*
      Loading message.
    */

    const loading =
      addMessage(
        'Typing...',
        'bot'
      );

    try {

      const response =
        await fetch(
          API_BASE + '/api/chat',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              orgId: orgId,

              sessionId:
                sessionId,

              message:
                message,

              channel:
                'widget'
            })
          }
        );

      const data =
        await response.json();

      loading.remove();

      if (!response.ok) {

        addMessage(
          data.error ||
            'Sorry, something went wrong.',
          'bot'
        );

        return;
      }

      addMessage(
        data.reply ||
          'Sorry, I could not generate a response.',
        'bot'
      );

    } catch (error) {

      console.error(
        'OneWay Bot:',
        error
      );

      loading.remove();

      addMessage(
        'Unable to connect to the chatbot. Please try again.',
        'bot'
      );

    } finally {

      send.disabled = false;

      input.disabled = false;

      input.focus();
    }
  }

  /* =========================
     EVENTS
  ========================= */

  button.addEventListener(
    'click',
    openChat
  );

  close.addEventListener(
    'click',
    closeChat
  );

  send.addEventListener(
    'click',
    sendMessage
  );

  input.addEventListener(
    'keydown',
    function (event) {

      if (
        event.key === 'Enter'
      ) {

        event.preventDefault();

        sendMessage();
      }
    }
  );

})();