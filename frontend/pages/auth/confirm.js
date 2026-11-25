import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import ResendConfirmation from '../../components/ResendConfirmation';

/*
 * Signup email confirmation — the dedicated callback for Supabase
 * "Confirm signup" emails (signup.js points emailRedirectTo here).
 *
 * Why this page exists: the Supabase client runs with
 * detectSessionInUrl: false, so a confirmation link used to land on
 * the home page with live session tokens in the URL hash that nothing
 * consumed — the account was confirmed server-side, but the visitor
 * was not signed in, the tokens sat in the address bar of an
 * analytics-tracked page, and an expired link failed silently.
 *
 * Contract (mirrors /reset-password; reviewed by ChatGPT Thinking and
 * Gemini, Nov 2026):
 *   - Callback credentials are read into memory and the URL is
 *     scrubbed via history.replaceState BEFORE any async call. They
 *     are never logged, rendered, or sent to analytics (this page is
 *     on the PostHog exclusion list and is noindex).
 *   - Only signup-shaped credentials are accepted: hash tokens require
 *     type=signup when a type is present; ?token_hash= accepts only
 *     type signup/email; other flows (recovery, magiclink,
 *     email_change) are refused here — flow separation, with Supabase
 *     still doing the cryptographic validation.
 *   - An existing session is never silently replaced. For hash tokens
 *     the candidate user is validated with getUser(token) BEFORE
 *     setSession persists anything; if it is a different account, the
 *     visitor must explicitly confirm the switch. For ?code= and
 *     ?token_hash= (which persist on exchange), a signed-in visitor
 *     gets the same explicit switch prompt before anything is consumed.
 *   - Every Supabase call is time-boxed and single-use credentials are
 *     never retried. A timeout is indeterminate: the outcome is settled
 *     by one final getSession() check, not by assumption.
 *   - Expired / used / scanner-consumed links get a clear invalid
 *     state with a resend form (generic anti-enumeration messaging).
 */

const AUTH_CALL_TIMEOUT_MS = 8000;
const VERIFY_WATCHDOG_MS = 15000;
const OTP_TYPES = ['signup', 'email'];

// Callback credentials extracted from the URL, kept in module scope so
// an effect remount (StrictMode dev double-invoke) reuses them after
// the first run scrubbed the URL. Memory only — never persisted.
let stashedCallback = null;

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((resolve) =>
      setTimeout(() => resolve(null), AUTH_CALL_TIMEOUT_MS)
    ),
  ]);
}

export default function ConfirmEmail() {
  const router = useRouter();
  // verifying | success | switch | invalid | idle
  const [status, setStatus] = useState('verifying');
  const [switchedFrom, setSwitchedFrom] = useState('');
  const [signedInEmail, setSignedInEmail] = useState('');
  const [keptSession, setKeptSession] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);
  const pendingRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let decided = false;

    const succeed = (note) => {
      if (cancelled || decided) return;
      decided = true;
      clearTimeout(watchdog);
      if (note) setSwitchedFrom(note);
      setStatus('success');
    };

    const fail = () => {
      if (cancelled || decided) return;
      decided = true;
      clearTimeout(watchdog);
      setStatus('invalid');
    };

    // A timed-out auth call is indeterminate — settle by checking
    // whether a session actually landed before declaring failure.
    const settleIndeterminate = async () => {
      const result = await withTimeout(supabase.auth.getSession());
      if (result?.data?.session?.user) succeed('');
      else fail();
    };

    const watchdog = setTimeout(() => {
      if (!cancelled && !decided) settleIndeterminate();
    }, VERIFY_WATCHDOG_MS);

    const askSwitch = (pending, currentEmail) => {
      if (cancelled || decided) return;
      decided = true;
      clearTimeout(watchdog);
      pendingRef.current = pending;
      setSignedInEmail(currentEmail || 'another account');
      setStatus('switch');
    };

    (async () => {
      // Step 1 — extract credentials into memory, scrub the URL first.
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash
      );
      const queryParams = new URLSearchParams(window.location.search);

      let extracted = {
        error: hashParams.get('error') || queryParams.get('error'),
        type: hashParams.get('type'),
        accessToken: hashParams.get('access_token'),
        refreshToken: hashParams.get('refresh_token'),
        code: queryParams.get('code'),
        tokenHash: queryParams.get('token_hash'),
        queryType: queryParams.get('type'),
      };

      const urlHasCredentials = Boolean(
        extracted.error ||
          extracted.accessToken ||
          extracted.code ||
          extracted.tokenHash
      );
      if (urlHasCredentials) stashedCallback = extracted;
      else if (stashedCallback) extracted = stashedCallback;
      const { error, type, accessToken, refreshToken, code, tokenHash, queryType } =
        extracted;

      window.history.replaceState(null, '', window.location.pathname);

      // Step 2 — an explicit error in the callback means a dead link.
      if (error) {
        fail();
        return;
      }

      const hasCredentials = Boolean(accessToken || code || tokenHash);

      // Who is signed in right now (if anyone)? Needed for the
      // account-switch guard and for the neutral state.
      const sessionResult = await withTimeout(supabase.auth.getSession());
      const currentUser = sessionResult?.data?.session?.user || null;

      // Step 3 — no credentials: neutral state, not an error.
      if (!hasCredentials) {
        if (cancelled || decided) return;
        decided = true;
        clearTimeout(watchdog);
        if (currentUser) setSignedInEmail(currentUser.email || '');
        setStatus('idle');
        return;
      }

      // Step 4 — implicit (hash) tokens: validate the candidate user
      // BEFORE persisting anything, so a different account is never
      // signed in silently.
      if (accessToken && refreshToken) {
        if (type && type !== 'signup') {
          fail();
          return;
        }
        const candidate = await withTimeout(
          supabase.auth.getUser(accessToken)
        );
        if (candidate === null) {
          settleIndeterminate();
          return;
        }
        if (candidate.error || !candidate.data?.user) {
          fail();
          return;
        }
        const candidateUser = candidate.data.user;
        if (currentUser && currentUser.id !== candidateUser.id) {
          askSwitch(
            { kind: 'hash', accessToken, refreshToken },
            currentUser.email
          );
          return;
        }
        const result = await withTimeout(
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        );
        if (result === null) {
          settleIndeterminate();
          return;
        }
        if (!result.error && result.data?.session?.user) succeed('');
        else fail();
        return;
      }

      // Step 5 — token_hash: only signup-shaped OTP types.
      if (tokenHash) {
        const otpType = queryType || 'signup';
        if (!OTP_TYPES.includes(otpType)) {
          fail();
          return;
        }
        if (currentUser) {
          askSwitch(
            { kind: 'otp', tokenHash, otpType },
            currentUser.email
          );
          return;
        }
        const result = await withTimeout(
          supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
        );
        if (result === null) {
          settleIndeterminate();
          return;
        }
        if (!result.error && result.data?.session?.user) succeed('');
        else fail();
        return;
      }

      // Step 6 — PKCE code. The exchange needs the code verifier from
      // the browser that started signup; in another browser it fails
      // cleanly into the invalid state + resend form.
      if (code) {
        if (currentUser) {
          askSwitch({ kind: 'code', code }, currentUser.email);
          return;
        }
        const result = await withTimeout(
          supabase.auth.exchangeCodeForSession(code)
        );
        if (result === null) {
          settleIndeterminate();
          return;
        }
        if (!result.error && result.data?.session?.user) succeed('');
        else fail();
        return;
      }

      fail();
    })();

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Success: auto-continue to the dashboard, with an immediate button
  // as well. Timer is cleaned up on unmount.
  useEffect(() => {
    if (status !== 'success') return undefined;
    const t = setTimeout(() => router.replace('/dashboard'), 2000);
    return () => clearTimeout(t);
  }, [status, router]);

  async function handleSwitchConfirm() {
    const pending = pendingRef.current;
    if (!pending || switchBusy) return;
    setSwitchBusy(true);
    try {
      let result = null;
      if (pending.kind === 'hash') {
        result = await withTimeout(
          supabase.auth.setSession({
            access_token: pending.accessToken,
            refresh_token: pending.refreshToken,
          })
        );
      } else if (pending.kind === 'otp') {
        result = await withTimeout(
          supabase.auth.verifyOtp({
            token_hash: pending.tokenHash,
            type: pending.otpType,
          })
        );
      } else if (pending.kind === 'code') {
        result = await withTimeout(
          supabase.auth.exchangeCodeForSession(pending.code)
        );
      }
      pendingRef.current = null;
      stashedCallback = null;
      if (result && !result.error && result.data?.session?.user) {
        setSwitchedFrom(signedInEmail);
        setStatus('success');
      } else if (result === null) {
        const check = await withTimeout(supabase.auth.getSession());
        if (check?.data?.session?.user) {
          setSwitchedFrom(signedInEmail);
          setStatus('success');
        } else {
          setStatus('invalid');
        }
      } else {
        setStatus('invalid');
      }
    } finally {
      setSwitchBusy(false);
    }
  }

  function handleSwitchCancel() {
    pendingRef.current = null;
    stashedCallback = null;
    setKeptSession(true);
    setStatus('idle');
  }

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gray-50 px-5 py-16">
      <Head>
        <title>Confirm your email — OneWayChat</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
            C
          </div>

          <h1 className="h-display text-2xl">Confirm your email</h1>

          <p className="mt-1.5 text-sm text-ink-500">
            One last step to activate your OneWayChat account.
          </p>
        </div>

        <div className="card p-7 sm:p-8">
          {status === 'verifying' && (
            <p
              role="status"
              aria-live="polite"
              className="py-4 text-center text-sm text-ink-500"
            >
              Confirming your email…
            </p>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Email confirmed successfully! Your account is ready.
              </div>

              {switchedFrom && (
                <p className="text-[13px] leading-relaxed text-ink-500">
                  You were signed in as {switchedFrom} — you are now
                  signed in with the account this link confirmed.
                </p>
              )}

              <Link
                href="/dashboard"
                className="btn-primary block py-2.5 text-center"
              >
                Continue to dashboard
              </Link>

              <p className="text-center text-[13px] text-ink-500">
                Taking you there automatically…
              </p>
            </div>
          )}

          {status === 'switch' && (
            <div className="space-y-4">
              <div
                role="alert"
                className="rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-800"
              >
                You are currently signed in as {signedInEmail}. This
                confirmation link belongs to a different account.
                Continuing will sign you out of the current account and
                sign you in with the confirmed one.
              </div>

              <button
                type="button"
                onClick={handleSwitchConfirm}
                disabled={switchBusy}
                className="btn-primary w-full py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {switchBusy ? 'Switching...' : 'Switch account and continue'}
              </button>

              <button
                type="button"
                onClick={handleSwitchCancel}
                disabled={switchBusy}
                className="btn-secondary w-full py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep my current session
              </button>
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-5">
              <div
                role="alert"
                className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-600"
              >
                This confirmation link is no longer valid. It may have
                expired or already been used — some email apps also open
                links automatically to scan them, which can use a link
                up. If you have already confirmed your email, try
                signing in. Otherwise request a new link below.
              </div>

              <ResendConfirmation />

              <p className="text-center text-sm text-ink-500">
                Already confirmed?{' '}
                <Link
                  href="/login"
                  className="font-medium text-brand-700 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {status === 'idle' && (
            <div className="space-y-5">
              {keptSession && (
                <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  No problem — your current session was kept.
                </div>
              )}

              {signedInEmail ? (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-ink-500">
                    You are signed in as {signedInEmail}. If you were
                    looking for a confirmation link, open the newest
                    confirmation email and click its link. To get a new
                    link for a different email address, use the form
                    below.
                  </p>
                  <Link
                    href="/dashboard"
                    className="btn-primary block py-2.5 text-center"
                  >
                    Go to dashboard
                  </Link>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-ink-500">
                  Open the confirmation email we sent when you signed up
                  and click its link — it brings you back here and
                  finishes activating your account. If the email never
                  arrived, request a new link below.
                </p>
              )}

              <ResendConfirmation />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
