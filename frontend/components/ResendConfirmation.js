import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

/*
 * ResendConfirmation — shared "resend my signup confirmation email"
 * form, used on /auth/confirm and on the login page when Supabase
 * reports "Email not confirmed".
 *
 * Anti-enumeration contract (same discipline as /forgot-password):
 * EVERY outcome — success, unknown email, already-confirmed email,
 * rate limit, network error — shows the exact same message. Supabase
 * deliberately returns an empty success for unknown and
 * already-confirmed addresses, so the UI must never treat a response
 * as proof an email was sent, and never surface a raw error.
 *
 * A 60-second cooldown matches Supabase's per-user resend limit and
 * stops the button being used as an email-spam lever.
 */

const GENERIC_MESSAGE =
  'If an account with this email address needs confirmation, a new link will be sent. Please check your inbox and spam folder.';
const COOLDOWN_SECONDS = 60;

export default function ResendConfirmation({ initialEmail = '' }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Keep the field in step with the email typed elsewhere (e.g. the
  // login form above this component).
  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(
      () => setCooldown((c) => Math.max(0, c - 1)),
      1000
    );
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleResend(event) {
    event.preventDefault();
    const target = email.trim();
    if (!target || busy || cooldown > 0) return;

    setBusy(true);
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: target,
        options: {
          emailRedirectTo: `${window.location.origin}${router.basePath}/auth/confirm`,
        },
      });
    } catch {
      // Identical outcome shown either way — see the contract above.
    } finally {
      setBusy(false);
      setSent(true);
      setCooldown(COOLDOWN_SECONDS);
    }
  }

  return (
    <div>
      <form onSubmit={handleResend} className="space-y-3" noValidate>
        <div>
          <label
            htmlFor="resend-email"
            className="mb-1.5 block text-[13px] font-medium text-ink-700"
          >
            Email address
          </label>
          <input
            id="resend-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@business.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base"
          />
        </div>

        <button
          type="submit"
          disabled={busy || cooldown > 0 || !email.trim()}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? 'Sending...'
            : cooldown > 0
              ? `Resend again in ${cooldown}s`
              : 'Resend confirmation email'}
        </button>
      </form>

      {sent && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {GENERIC_MESSAGE}
        </div>
      )}
    </div>
  );
}
