/*
|--------------------------------------------------------------------------
| Widget text — shared contract
|--------------------------------------------------------------------------
|
| The two admin-customizable composer strings (Send button label and
| message-input placeholder), with their canonical defaults, length
| caps and normalisation. Used by:
|   - PATCH /api/org/settings  (write side: strict validation)
|   - GET /api/chat/config/:id (read side: fallback to defaults)
|   - GET /bot/:orgId          (read side: same fallback)
|
| Contract (reviewed 2026-11-25, ChatGPT + Gemini):
|   - Values are stored as PLAIN text, never pre-escaped HTML.
|     Renderers are responsible for safe insertion (DOM properties
|     in the widget, HTML-escaping on the server-rendered page).
|   - Omitted PATCH field  -> leave the stored value unchanged.
|   - Empty / whitespace   -> reset to the default.
|   - Non-string value     -> rejected on write, default on read.
|   - Length is counted by Unicode code points, after trimming and
|     stripping newlines / control characters (single-line fields).
|
*/

const WIDGET_TEXT_FIELDS = {
  send_button_text: { default: 'Send', max: 24, label: 'Send button text' },
  input_placeholder: { default: 'Type a message...', max: 100, label: 'Input placeholder' },
};

function cleanSingleLine(value) {
  // Newlines and control characters become a space, runs collapse.
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function codePointLength(value) {
  return Array.from(value).length;
}

/**
 * Write side (PATCH /api/org/settings).
 * Returns { value } to store, or { error } with a client-facing message.
 */
function normalizeWidgetTextForSave(field, raw) {
  const spec = WIDGET_TEXT_FIELDS[field];
  if (!spec) return { error: `Unknown widget text field: ${field}` };
  if (typeof raw !== 'string') {
    return { error: `${spec.label} must be text.` };
  }
  const cleaned = cleanSingleLine(raw);
  if (!cleaned) return { value: spec.default };
  if (codePointLength(cleaned) > spec.max) {
    return { error: `${spec.label} must be ${spec.max} characters or fewer.` };
  }
  return { value: cleaned };
}

/**
 * Read side (public config + hosted page).
 * Always returns a usable string: the stored value when it is a
 * non-blank string, otherwise the canonical default. Over-long
 * legacy values are truncated to the cap rather than breaking the
 * composer layout.
 */
function widgetTextOrDefault(field, raw) {
  const spec = WIDGET_TEXT_FIELDS[field];
  if (!spec) return '';
  if (typeof raw !== 'string') return spec.default;
  const cleaned = cleanSingleLine(raw);
  if (!cleaned) return spec.default;
  if (codePointLength(cleaned) > spec.max) {
    return Array.from(cleaned).slice(0, spec.max).join('');
  }
  return cleaned;
}

module.exports = {
  WIDGET_TEXT_FIELDS,
  normalizeWidgetTextForSave,
  widgetTextOrDefault,
};
