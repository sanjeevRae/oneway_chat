(function () {
  'use strict';

  const script = document.currentScript;

  if (!script) {
    console.error('OneWay Bot: script not found.');
    return;
  }

  const scriptUrl = new URL(script.src);
  const orgId = scriptUrl.searchParams.get('org');

  if (!orgId) {
    console.error('OneWay Bot: organization ID missing.');
    return;
  }

  const API_URL = '/chat-api/api/chat';

  const sessionKey =
    'onewaybot_session_' + orgId;

  let sessionId =
    localStorage.getItem(sessionKey);

  if (!sessionId) {

    if (
      window.crypto &&
      typeof window.crypto.randomUUID === 'function'
    ) {
      sessionId = window.crypto.randomUUID();
    } else {
      sessionId =
        'session_' +
        Date.now() +
        '_' +
        Math.random()
          .toString(36)
          .substring(2);
    }

    localStorage.setItem(
      sessionKey,
      sessionId
    );
  }

  const messages =
    document.getElementById('messages');

  const input =
    document.getElementById('input');

  const send =
    document.getElementById('send');

  if (!messages || !input || !send) {
    console.error(
      'OneWay Bot: Chat elements not found.'
    );
    return;
  }

  function addMessage(text, type) {

    const div =
      document.createElement('div');

    div.className =
      'message ' + type;

    /* USER MESSAGE — plain text, no markdown */
    if (type === 'user') {
      div.textContent = String(text || '');
    }
    /* BOT MESSAGE — render markdown */
    else {
      div.innerHTML = renderMarkdown(String(text || ''));
    }

    messages.appendChild(div);

    messages.scrollTop =
      messages.scrollHeight;

    return div;
  }

  /* ============================================================
     MARKDOWN → HTML
     Supports: **bold**, *italic*, `code`, - bullets, 1. numbered,
     ### headings, [links](url), > blockquotes, horizontal rules.
     ============================================================ */

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderMarkdown(text) {
    if (!text) return '';

    let source = String(text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    // Escape HTML first so user content is safe
    let html = escapeHtml(source);

    // Code blocks (triple backticks)
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`([^\n`]+)`/g, '<code>$1</code>');

    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Links
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr>');

    // Tables: | a | b | c |
    html = html.replace(/^\s*\|(.+)\|\s*$/gm, '<table-row>$1</table-row>');
    html = html.replace(/<table-row>([^<]*)\|([^<]*)<\/table-row>/g,
      '<table-row>$1|$2</table-row>');

    // Line-based: lists, blockquotes, paragraphs, tables
    const lines = html.split('\n');
    const output = [];
    let inList = false;
    let listType = null;
    let inTable = false;
    let tableHeader = null;
    let tableRows = [];

    function closeList() {
      if (!inList) return;
      output.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }

    function closeTable() {
      if (!inTable) return;
      const cells = (tableHeader || '').split('|').map(c => c.trim());
      const rows = tableRows.map(r => r.split('|').map(c => c.trim()));
      output.push(
        '<div class="table-wrap"><table>' +
        '<thead><tr>' + cells.map(h => '<th>' + h + '</th>').join('') + '</tr></thead>' +
        '<tbody>' + rows.map(r =>
          '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>'
        ).join('') + '</tbody>' +
        '</table></div>'
      );
      inTable = false;
      tableHeader = null;
      tableRows = [];
    }

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) { closeList(); closeTable(); continue; }

      // Table row
      if (/^\|.+\|$/.test(line)) {
        closeList();
        if (!inTable) { inTable = true; tableHeader = line; }
        else { tableRows.push(line); }
        continue;
      }

      // Skip table separator rows like |---|---|
      if (inTable && /^[\s\|:\-]+$/.test(line)) continue;

      // Not a table row — close any open table
      closeTable();

      // Unordered list
      const unordered = line.match(/^[-*+]\s+(.+)$/);
      if (unordered) {
        if (!inList || listType !== 'ul') { closeList(); output.push('<ul>'); inList = true; listType = 'ul'; }
        output.push('<li>' + unordered[1] + '</li>');
        continue;
      }

      // Ordered list
      const ordered = line.match(/^(\d+)\.\s+(.+)$/);
      if (ordered) {
        if (!inList || listType !== 'ol') { closeList(); output.push('<ol>'); inList = true; listType = 'ol'; }
        output.push('<li>' + ordered[2] + '</li>');
        continue;
      }

      closeList();

      // Blockquote
      if (line.startsWith('&gt; ')) {
        output.push('<blockquote>' + line.substring(6) + '</blockquote>');
        continue;
      }

      // Already-rendered block HTML
      if (/^<(h[1-3]|pre|blockquote|hr|div)>/.test(line)) {
        output.push(line);
        continue;
      }

      // Normal paragraph
      output.push('<p>' + line + '</p>');
    }
    closeList();
    closeTable();

    return output.join('');
  }

  /* ============================================================
     ANIMATED TYPING BUBBLE
     ============================================================ */

  function addTyping() {

    const div =
      document.createElement('div');

    div.className =
      'message bot typing';

    for (let i = 0; i < 3; i += 1) {
      div.appendChild(
        document.createElement('span')
      );
    }

    messages.appendChild(div);

    messages.scrollTop =
      messages.scrollHeight;

    return div;
  }

  /*
  |--------------------------------------------------------------------------
  | Welcome message
  |--------------------------------------------------------------------------
  |
  | Injected server-side by the bot page (data-bot-welcome);
  | falls back to the default when missing.
  |
  */

  const welcomeMessage =
    document.body.dataset.botWelcome ||
    'Hi! How can I help you today?';

  addMessage(
    welcomeMessage,
    'bot'
  );

  /*
  |--------------------------------------------------------------------------
  | Send message
  |--------------------------------------------------------------------------
  */

  async function sendMessage() {

    const message =
      input.value.trim();

    if (!message) {
      return;
    }

    input.value = '';

    input.disabled = true;
    send.disabled = true;

    addMessage(
      message,
      'user'
    );

    const loading =
      addTyping();

    try {

      const response =
        await fetch(
          API_URL,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              orgId: orgId,
              sessionId: sessionId,
              message: message,
              channel: 'web'
            })
          }
        );

      let data;

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }

      loading.remove();

      if (!response.ok) {

        addMessage(
          data.error ||
          'Something went wrong. Please try again.',
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
        'OneWay Bot error:',
        error
      );

      loading.remove();

      addMessage(
        'Unable to connect to the chatbot. Please try again.',
        'bot'
      );

    } finally {

      input.disabled = false;
      send.disabled = false;

      input.focus();

    }
  }

  /*
  |--------------------------------------------------------------------------
  | Send button
  |--------------------------------------------------------------------------
  */

  send.addEventListener(
    'click',
    sendMessage
  );

  /*
  |--------------------------------------------------------------------------
  | Enter key
  |--------------------------------------------------------------------------
  */

  input.addEventListener(
    'keydown',
    function (event) {

      if (event.key === 'Enter') {

        event.preventDefault();

        sendMessage();

      }

    }
  );

})();
