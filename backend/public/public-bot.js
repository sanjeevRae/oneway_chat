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

    div.textContent = text;

    messages.appendChild(div);

    messages.scrollTop =
      messages.scrollHeight;

    return div;
  }

  /*
  |--------------------------------------------------------------------------
  | Welcome message
  |--------------------------------------------------------------------------
  */

  addMessage(
    'Hi! How can I help you today?',
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
      addMessage(
        'Typing...',
        'bot'
      );

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
