import { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

/*
 * Reset password — landing page for Supabase recovery email links.
 *
 * Security contract (reviewed 2026-11-25, ChatGPT 7.5/10 + Gemini 6.5/10):
 *
 * 1. RECOVERY PROOF, NOT JUST A SESSION. The form unlocks only on
 *    explicit proof from THIS visit that the visitor arrived through a
 *    recovery link:
 *      - a URL hash with type=recovery + access_token + refresh_token
 *        that setSession() accepts, or
 *      - a ?token_hash= that verifyOtp() accepts (email templates
 *        built on {{ .TokenHash }}), or
 *      - a ?code= that exchangeCodeForSession() accepts (this URL is
 *        only ever used as the recovery redirectTo, so a code landing
 *        here belongs to a recovery flow), or
 *      - a PASSWORD_RECOVERY auth event, or
 *      - the tab-scoped marker described in (3), matched to the
 *        current session's user.
 *    An ordinary logged-in session (getSession / SIGNED_IN /
 *    INITIAL_SESSION from _app.js) NEVER unlocks the form — otherwise
 *    anyone at a logged-in browser could change the password with no
 *    email proof.
 *
 * 2. TOKENS ARE SCRUBBED FIRST. Callback credentials are read into
 *    memory and removed from the URL with history.replaceState BEFORE
 *    any async Supabase call, and are never logged. PostHog does not
 *    initialise on this page at all (see components/PostHog.js).
 *
 * 3. REFRESH SURVIVAL, TAB-SCOPED. After verification, a marker
 *    (user id + timestamp, 60 min) is kept in sessionStorage so a
 *    refresh doesn't strand the user. The marker is only ever written
 *    after real token verification — it is a convenience for the same
 *    tab, never a substitute for the initial proof.
 *
 * 4. AFTER THE UPDATE: signOut({ scope: 'global' }) revokes every
 *    session for the user. If that call fails, a local sign-out is
 *    attempted and the success screen says honestly that signing out
 *    other devices could not be confirmed.
 *
 * Raw Supabase error text is never shown; errors are mapped to plain
 * categories below.
 */

const MARKER_KEY = 'onewaychat-recovery-verified';
const MARKER_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD = 8;

/*
 * Every verification step is time-boxed. A Supabase auth call can stall
 * (auth-lock contention with the _app session restore, a slow network),
 * and "Verifying your reset link…" must never spin forever: any step
 * that does not settle in time resolves as a failure and the visitor
 * gets the invalid-link screen with a way to request a fresh link.
 */
const AUTH_CALL_TIMEOUT_MS = 8000;
const VERIFY_WATCHDOG_MS = 12000;

/*
 * Callback credentials extracted from the URL, kept in module scope.
 * The URL is scrubbed on first read; if the effect remounts
 * (StrictMode dev double-invoke) the second run finds a clean URL and
 * reuses this stash instead of concluding the link carried nothing.
 */
let stashedCallback = null;

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), AUTH_CALL_TIMEOUT_MS)),
  ]);
}

function readMarker() {
  try {
    const raw = sessionStorage.getItem(MARKER_KEY);
    if (!raw) return null;
    const marker = JSON.parse(raw);
    if (!marker?.userId || !marker?.at) return null;
    if (Date.now() - marker.at > MARKER_TTL_MS) return null;
    return marker;
  } catch {
    return null;
  }
}

function writeMarker(userId) {
  try {
    sessionStorage.setItem(MARKER_KEY, JSON.stringify({ userId, at: Date.now() }));
  } catch {
    // Storage unavailable — refresh will need a fresh link.
  }
}

function clearMarker() {
  try {
    sessionStorage.removeItem(MARKER_KEY);
  } catch {
    // Ignore.
  }
}

export default function ResetPassword() {
  // 'verifying' | 'ready' | 'invalid' | 'success'
  const [status, setStatus] = useState('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revocationWarning, setRevocationWarning] = useState(false);

  /*
   * No mount guard here on purpose: React 18 StrictMode (next dev)
   * mounts, unmounts and remounts effects, and a startedRef guard
   * leaves the live mount with verification cancelled and its watchdog
   * cleared — "Verifying…" forever. Instead every effect run is
   * self-contained and its cleanup cancels only its own run, so a
   * remount simply runs verification again from the top.
   */
  useEffect(() => {
    let cancelled = false;
    let decided = false;

    const verify = (userId) => {
      if (cancelled || decided) return;
      decided = true;
      clearTimeout(watchdog);
      if (userId) writeMarker(userId);
      setStatus('ready');
    };

    const invalidate = () => {
      if (cancelled || decided) return;
      decided = true;
      clearTimeout(watchdog);
      setStatus('invalid');
    };

    // Hard watchdog: whatever happens below, "Verifying" always ends.
    const watchdog = setTimeout(invalidate, VERIFY_WATCHDOG_MS);

    // PASSWORD_RECOVERY is a supported proof path (it can fire when the
    // SDK processes a callback). The listener never makes Supabase calls.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user?.id) {
        verify(session.user.id);
      }
    });

    (async () => {
      /*
       * Step 1 — extract callback credentials into memory and scrub the
       * URL immediately, before any await.
       */
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash
      );
      const queryParams = new URLSearchParams(window.location.search);

      let extracted = {
        hashError: hashParams.get('error') || queryParams.get('error'),
        type: hashParams.get('type'),
        accessToken: hashParams.get('access_token'),
        refreshToken: hashParams.get('refresh_token'),
        code: queryParams.get('code'),
        tokenHash: queryParams.get('token_hash'),
        queryType: queryParams.get('type'),
      };

      const urlHasCredentials = Boolean(
        extracted.hashError ||
          extracted.accessToken ||
          extracted.code ||
          extracted.tokenHash
      );
      if (urlHasCredentials) {
        stashedCallback = extracted;
      } else if (stashedCallback) {
        extracted = stashedCallback;
      }
      const {
        hashError,
        type,
        accessToken,
        refreshToken,
        code,
        tokenHash,
        queryType,
      } = extracted;

      window.history.replaceState(null, '', window.location.pathname);

      // Step 2 — an explicit error in the callback means a dead link.
      if (hashError) {
        invalidate();
        return;
      }

      // Step 3 — implicit (hash) recovery.
      if (type === 'recovery' && accessToken && refreshToken) {
        const result = await withTimeout(
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        );
        if (result && !result.error && result.data?.session?.user?.id) {
          verify(result.data.session.user.id);
          return;
        }
        invalidate();
        return;
      }

      // Step 4 — token_hash recovery (email templates built on
      // {{ .TokenHash }} link straight here with ?token_hash=&type=).
      if (tokenHash) {
        const result = await withTimeout(
          supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: queryType || 'recovery',
          })
        );
        if (result && !result.error && result.data?.session?.user?.id) {
          verify(result.data.session.user.id);
          return;
        }
        invalidate();
        return;
      }

      // Step 5 — PKCE code recovery.
      if (code) {
        const result = await withTimeout(
          supabase.auth.exchangeCodeForSession(code)
        );
        if (result && !result.error && result.data?.session?.user?.id) {
          verify(result.data.session.user.id);
          return;
        }
        invalidate();
        return;
      }

      // Step 6 — refresh survival: tab marker + matching live session.
      const marker = readMarker();
      if (marker) {
        const result = await withTimeout(supabase.auth.getSession());
        const session = result?.data?.session;
        if (session?.user?.id === marker.userId) {
          verify(session.user.id);
          return;
        }
        clearMarker();
      }

      /*
       * Step 7 — give a PASSWORD_RECOVERY event a brief chance to
       * arrive; after that, no proof means no form. An ordinary session
       * restoring in _app.js does not change this outcome.
       */
      setTimeout(invalidate, 2500);
    })();

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (Array.from(password).length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        const msg = (updateError.message || '').toLowerCase();
        if (msg.includes('different from the old')) {
          setError('Choose a password that is different from your current one.');
        } else if (msg.includes('weak') || msg.includes('password should be')) {
          setError(`That password does not meet the requirements — use at least ${MIN_PASSWORD} characters.`);
        } else if (
          msg.includes('session') ||
          msg.includes('expired') ||
          msg.includes('not found') ||
          msg.includes('jwt')
        ) {
          clearMarker();
          setStatus('invalid');
        } else {
          setError('Something went wrong. Please try again.');
        }
        return;
      }

      // Password changed — revoke every session, this one included.
      clearMarker();
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
        if (signOutError) throw signOutError;
      } catch {
        setRevocationWarning(true);
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // Nothing more can be done client-side.
        }
      }
      setStatus('success');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gray-50 px-5 py-16">
      <Head>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
            C
          </div>

          <h1 className="h-display text-2xl">Set a new password</h1>

          <p className="mt-1.5 text-sm text-ink-500">
            Choose a new password for your OneWayChat account.
          </p>
        </div>

        <div className="card p-7 sm:p-8">
          {status === 'verifying' && (
            <p role="status" aria-live="polite" className="py-4 text-center text-sm text-ink-500">
              Verifying your reset link…
            </p>
          )}

          {status === 'invalid' && (
            <div className="space-y-4">
              <div
                role="alert"
                className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-600"
              >
                This reset link is invalid or has expired. Reset links can
                only be used once — request a new one and use the newest
                email.
              </div>

              <Link href="/forgot-password" className="btn-primary block py-2.5 text-center">
                Request a new reset link
              </Link>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1.5 block text-[13px] font-medium text-ink-700"
                >
                  New password
                </label>

                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder={`Minimum ${MIN_PASSWORD} characters`}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input-base"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1.5 block text-[13px] font-medium text-ink-700"
                >
                  Confirm new password
                </label>

                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Type it again"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="input-base"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-500">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                  className="h-4 w-4"
                />
                Show passwords
              </label>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600"
                >
                  {error}
                </div>
              )}

              <button disabled={busy} className="btn-primary w-full py-2.5">
                {busy ? 'Updating…' : 'Update password'}
              </button>

              <p className="text-center text-xs leading-relaxed text-ink-400">
                For security, you&apos;ll be signed out on all devices and
                will need to log in again with the new password.
              </p>
            </form>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg border border-green-100 bg-green-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-green-700"
              >
                Your password has been updated. You can now log in using
                your new password.
              </div>

              {revocationWarning && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-700"
                >
                  Your password was changed, but signing out your other
                  devices could not be confirmed. If you&apos;re signed in
                  anywhere else, sign out there too.
                </div>
              )}

              <Link href="/login" className="btn-primary block py-2.5 text-center">
                Continue to log in
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
