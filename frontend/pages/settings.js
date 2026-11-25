import { useState, useEffect } from 'react';
import { api } from '../lib/supabaseClient';

const DEFAULT_WELCOME = 'Hi! How can I help you today?';
const DEFAULT_SEND = 'Send';
const DEFAULT_PLACEHOLDER = 'Type a message...';
const SEND_MAX = 24;
const PLACEHOLDER_MAX = 100;

export default function Settings() {
  const [form, setForm] = useState({
    name: '',
    industry: '',
    bot_name: '',
    welcome_message: '',
    send_button_text: '',
    input_placeholder: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api('/api/org/me')
      .then((d) => {
        setForm({
          name: d.org?.name || '',
          industry: d.org?.industry || '',
          bot_name: d.settings?.bot_name || '',
          welcome_message: d.settings?.welcome_message || DEFAULT_WELCOME,
          send_button_text: d.settings?.send_button_text || DEFAULT_SEND,
          input_placeholder: d.settings?.input_placeholder || DEFAULT_PLACEHOLDER,
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      // Two endpoints: org profile + bot settings, saved in parallel.
      await Promise.all([
        api('/api/org/profile', {
          method: 'PATCH',
          body: JSON.stringify({ name: form.name, industry: form.industry }),
        }),
        api('/api/org/settings', {
          method: 'PATCH',
          body: JSON.stringify({
            bot_name: form.bot_name,
            welcome_message: form.welcome_message,
            send_button_text: form.send_button_text,
            input_placeholder: form.input_placeholder,
          }),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-400">Loading settings…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-12">
      {/* Page header */}
      <div className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="h-display text-2xl sm:text-[28px]">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">Your business details and how your bot introduces itself.</p>
      </div>

      <form onSubmit={save} className="space-y-5">
        {/* Business */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-ink-900">Business</h2>
          <p className="mt-0.5 text-xs text-ink-500">Basic details about your company.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-700">Business name</span>
              <input
                required
                value={form.name}
                onChange={set('name')}
                placeholder="Acme Plumbing"
                className="input-base w-full !py-2 text-[13px]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-700">Industry</span>
              <input
                value={form.industry}
                onChange={set('industry')}
                placeholder="e.g. Plumbing, Dental, Real estate"
                className="input-base w-full !py-2 text-[13px]"
              />
            </label>
          </div>
        </section>

        {/* Bot personality */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-ink-900">Bot personality</h2>
          <p className="mt-0.5 text-xs text-ink-500">How your assistant introduces itself.</p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-700">Bot name</span>
              <input
                value={form.bot_name}
                onChange={set('bot_name')}
                placeholder="OneWay"
                className="input-base w-full !py-2 text-[13px]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-700">Welcome message</span>
              <textarea
                rows={3}
                value={form.welcome_message}
                onChange={set('welcome_message')}
                placeholder={DEFAULT_WELCOME}
                className="input-base w-full resize-none !py-2 text-[13px]"
              />
            </label>
          </div>
        </section>

        {/* Chat widget text */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-ink-900">Chat widget text</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            The text in the chat box on your website. Use your customers&apos; language —
            for example Enviar and Digite uma mensagem... in Portuguese. Leave a field
            blank to use its default.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-700">Send button text</span>
              <input
                value={form.send_button_text}
                onChange={set('send_button_text')}
                placeholder={DEFAULT_SEND}
                maxLength={SEND_MAX}
                className="input-base w-full !py-2 text-[13px]"
              />
              <span className="mt-1 block text-[11px] text-ink-400">
                {Array.from(form.send_button_text).length}/{SEND_MAX} characters
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-700">Message box placeholder</span>
              <input
                value={form.input_placeholder}
                onChange={set('input_placeholder')}
                placeholder={DEFAULT_PLACEHOLDER}
                maxLength={PLACEHOLDER_MAX}
                className="input-base w-full !py-2 text-[13px]"
              />
              <span className="mt-1 block text-[11px] text-ink-400">
                {Array.from(form.input_placeholder).length}/{PLACEHOLDER_MAX} characters
              </span>
            </label>
          </div>

          {/* Live preview — static mock of the widget composer, updates as you type */}
          <div className="mt-6">
            <span className="mb-1.5 block text-xs font-medium text-ink-700">Preview</span>
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="flex items-center justify-between bg-[#6366f1] px-4 py-3 text-sm font-semibold text-white">
                <span className="truncate">{form.bot_name.trim() || 'OneWay'}</span>
                <span aria-hidden="true" className="font-semibold">X</span>
              </div>
              <div className="bg-[#f7f7f7] px-3.5 py-3.5">
                <div className="max-w-[82%] rounded-xl rounded-bl-[3px] border border-[#eeeeee] bg-white px-3 py-2 text-[13px] leading-snug text-[#222222]">
                  {form.welcome_message.trim() || DEFAULT_WELCOME}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-[#dddddd] bg-white p-2.5">
                <input
                  readOnly
                  tabIndex={-1}
                  placeholder={form.input_placeholder.trim() || DEFAULT_PLACEHOLDER}
                  className="min-w-0 flex-1 rounded-[10px] border border-[#dddddd] px-2.5 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="max-w-[45%] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] bg-[#6366f1] px-4 py-2 text-sm text-white"
                >
                  {form.send_button_text.trim() || DEFAULT_SEND}
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-medium text-brand-600">Saved ✓</span>}
          <button type="submit" disabled={saving} className="btn-primary !px-5 !py-2 text-sm">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </main>
  );
}
