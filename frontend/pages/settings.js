import { useState, useEffect } from 'react';
import { api } from '../lib/supabaseClient';

const DEFAULT_WELCOME = 'Hi! How can I help you today?';

export default function Settings() {
  const [form, setForm] = useState({
    name: '',
    industry: '',
    bot_name: '',
    welcome_message: '',
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
