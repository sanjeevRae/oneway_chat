import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';

/*
 * Forgot password — request a Supabase recovery email.
 *
 * Security contract (reviewed 2026-11-25, ChatGPT + Gemini):
 * - The outcome shown is IDENTICAL for every API result — success,
 *   unknown email, rate limit (429) and network error all land on the
 *   same "if an account exists..." message. A different message for a
 *   rate limit would itself leak that the account exists (Supabase's
 *   per-user reset limit only triggers for real accounts), so no
 *   outcome is ever distinguished and no raw Supabase error is shown.
 * - No service-role key, no custom backend: resetPasswordForEmail
 *   with the public anon key only.
 * - The email is never put in a URL (history / analytics / logs);
 *   the login page hands it over through sessionStorage instead.
 * - The 60s resend cooldown is a usability guard against accidental
 *   duplicate sends, not a security boundary.
 */

const GENERIC_MESSAGE =
  'If an account exists for that email address, a password reset link will be sent when available. Please check your inbox, including spam, or try again later.';

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // One-time prefill from the login page (sessionStorage, then cleared).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('onewaychat-reset-email');
      if (saved) {
        setEmail(saved);
        sessionStorage.removeItem('onewaychat-reset-email');
      }
    } catch {
      // Storage unavailable — start empty.
    }
  }, []);

  // Resend cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || cooldown > 0) return;

    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${router.basePath}/reset-password`,
      });
    } catch {
      // Deliberately swallowed — see the security contract above.
    } finally {
      setBusy(false);
      setSent(true);
      setCooldown(60);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gray-50 px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
            C
          </div>

          <h1 className="h-display text-2xl">Reset your password</h1>

          <p className="mt-1.5 text-sm text-ink-500">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="card p-7 sm:p-8">
          {sent ? (
            <div className="space-y-4">
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg border border-green-100 bg-green-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-green-700"
              >
                {GENERIC_MESSAGE}
              </div>

              <p className="text-[13px] leading-relaxed text-ink-500">
                For security, reset links expire — if yours doesn&apos;t work,
                request a new one here. Didn&apos;t get the email? Check spam
                first, then send again.
              </p>

              <button
                onClick={handleSubmit}
                disabled={busy || cooldown > 0}
                className="btn-primary w-full py-2.5 disabled:opacity-60"
              >
                {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send again'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[13px] font-medium text-ink-700"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input-base"
                />
              </div>

              <button disabled={busy} className="btn-primary w-full py-2.5">
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          Remembered it?{' '}
          <Link
            href="/login"
            className="font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
