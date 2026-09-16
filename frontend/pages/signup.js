import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';

const INDUSTRIES = [
  'Restaurant',
  'Salon / Spa',
  'Retail Store',
  'Clinic',
  'Gym / Fitness',
  'Real Estate',
  'Education / Coaching',
  'Professional Services',
  'Other',
];

export default function Signup() {
  const router = useRouter();

  const [form, setForm] = useState({
    fullName: '',
    businessName: '',
    industry: INDUSTRIES[0],
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => {
    setForm({
      ...form,
      [key]: event.target.value,
    });
  };

  async function handleSubmit(event) {
    event.preventDefault();

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const {
        error,
      } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,

        options: {
          /*
           * After the user clicks the
           * Supabase confirmation email,
           * return them to the chatbot app.
           */
          emailRedirectTo:
            `${window.location.origin}/chat`,

          data: {
            full_name:
              form.fullName,

            business_name:
              form.businessName,

            industry:
              form.industry,
          },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      /*
       * Supabase email confirmation is enabled.
       *
       * Do NOT immediately push the user
       * to dashboard.
       */
      setSuccess(
        'Account created! Please check your email and click the confirmation link to continue.'
      );

    } catch (error) {
      console.error(
        'Signup error:',
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

      <div className="w-full max-w-md">

        <div className="mb-8 text-center">

          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
            C
          </div>

          <h1 className="h-display text-2xl">
            Create your AI assistant
          </h1>

          <p className="mt-1.5 text-sm text-ink-500">
            Free forever · No credit card required
          </p>

        </div>

        <div className="card p-7 sm:p-8">

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >

            <div className="grid gap-4 sm:grid-cols-2">

              <div>

                <label
                  htmlFor="fullName"
                  className="mb-1.5 block text-[13px] font-medium text-ink-700"
                >
                  Your name
                </label>

                <input
                  id="fullName"
                  required
                  placeholder="Jane Doe"
                  value={form.fullName}
                  onChange={set('fullName')}
                  className="input-base"
                />

              </div>

              <div>

                <label
                  htmlFor="businessName"
                  className="mb-1.5 block text-[13px] font-medium text-ink-700"
                >
                  Business name
                </label>

                <input
                  id="businessName"
                  required
                  placeholder="Bloom Salon"
                  value={form.businessName}
                  onChange={set('businessName')}
                  className="input-base"
                />

              </div>

            </div>

            <div>

              <label
                htmlFor="industry"
                className="mb-1.5 block text-[13px] font-medium text-ink-700"
              >
                Industry
              </label>

              <select
                id="industry"
                value={form.industry}
                onChange={set('industry')}
                className="input-base"
              >
                {INDUSTRIES.map(
                  (industry) => (
                    <option
                      key={industry}
                      value={industry}
                    >
                      {industry}
                    </option>
                  )
                )}
              </select>

            </div>

            <div>

              <label
                htmlFor="email"
                className="mb-1.5 block text-[13px] font-medium text-ink-700"
              >
                Work email
              </label>

              <input
                id="email"
                required
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={set('email')}
                className="input-base"
              />

            </div>

            <div>

              <label
                htmlFor="password"
                className="mb-1.5 block text-[13px] font-medium text-ink-700"
              >
                Password
              </label>

              <input
                id="password"
                required
                type="password"
                minLength={6}
                autoComplete="new-password"
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={set('password')}
                className="input-base"
              />

            </div>

            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-green-100 bg-green-50 px-3.5 py-2.5 text-[13px] text-green-700">
                {success}
              </div>
            )}

            <button
              disabled={busy}
              className="btn-primary w-full py-2.5"
            >
              {busy
                ? 'Creating account…'
                : 'Create free account'}
            </button>

            <p className="text-center text-xs leading-relaxed text-ink-400">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>

          </form>

        </div>

        <p className="mt-6 text-center text-sm text-ink-500">

          Already have an account?{' '}

          <Link
            href="/login"
            className="font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            Log in
          </Link>

        </p>

      </div>

    </main>
  );
}