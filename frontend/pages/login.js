import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ResendConfirmation from '../components/ResendConfirmation';

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notConfirmed, setNotConfirmed] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setBusy(true);
    setError('');
    setNotConfirmed(false);

    try {
      const {
        error,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        /*
         * "Email not confirmed" is the one login failure with a
         * self-serve fix: offer the resend form right here instead of
         * leaving the user at a dead end.
         */
        if (
          error.code === 'email_not_confirmed' ||
          /email not confirmed/i.test(error.message || '')
        ) {
          setNotConfirmed(true);
        }
        return;
      }

      /*
       * Next.js basePath automatically
       * makes this /chat/dashboard.
       */
      router.push('/dashboard');

    } catch (error) {
      console.error(
        'Login error:',
        error
      );

      setError(
        'Something went wrong. Please try again.'
      );

    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gray-50 px-5 py-16">

      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">

          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
            C
          </div>

          <h1 className="h-display text-2xl">
            Welcome back
          </h1>

          <p className="mt-1.5 text-sm text-ink-500">
            Log in to your OneWayChat assistant
          </p>

        </div>

        <div className="card p-7 sm:p-8">

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >

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
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="input-base"
              />

            </div>

            <div>

              <div className="mb-1.5 flex items-center justify-between">

                <label
                  htmlFor="password"
                  className="block text-[13px] font-medium text-ink-700"
                >
                  Password
                </label>

                <Link
                  href="/forgot-password"
                  onClick={() => {
                    /*
                     * Prefill the reset form with the typed email via
                     * sessionStorage — never as a ?email= URL parameter,
                     * which would leak the address into browser history,
                     * analytics and server logs.
                     */
                    try {
                      if (email.trim()) {
                        sessionStorage.setItem('onewaychat-reset-email', email.trim());
                      }
                    } catch {
                      // Storage unavailable — the form just starts empty.
                    }
                  }}
                  className="text-[13px] font-medium text-brand-600 transition-colors hover:text-brand-700"
                >
                  Forgot password?
                </Link>

              </div>

              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="input-base"
              />

            </div>

            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600">
                {error}
              </div>
            )}

            {notConfirmed && (
              <div className="space-y-3 rounded-lg border border-ink-100 bg-gray-50 px-3.5 py-3">
                <p className="text-[13px] font-medium text-ink-700">
                  Didn&apos;t receive your confirmation email?
                </p>
                <ResendConfirmation initialEmail={email} />
              </div>
            )}

            <button
              disabled={busy}
              className="btn-primary w-full py-2.5"
            >
              {busy
                ? 'Signing in…'
                : 'Log in'}
            </button>

          </form>

        </div>

        <p className="mt-6 text-center text-sm text-ink-500">

          Don&apos;t have an account?{' '}

          <Link
            href="/signup"
            className="font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            Sign up free
          </Link>

        </p>

      </div>

    </main>
  );
}