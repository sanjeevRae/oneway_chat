/**
 * Pre-build guard.
 *
 * `next build` inlines every NEXT_PUBLIC_* value into the client bundle — and it
 * does that *silently*. A missing env file still produces a "successful" build
 * that ships `undefined` as the API URL and Supabase keys, so the deployed app
 * looks fine until every single request fails.
 *
 * That matters here because `.env*.local` is gitignored: a fresh `git pull` on
 * the VPS does NOT bring the env file with it. This script turns that silent
 * failure into a loud, actionable error before the build starts.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mode = process.env.NODE_ENV || 'production';

// Next.js precedence, lowest -> highest.
const ENV_FILES = [
  '.env',
  `.env.${mode}`,
  '.env.local',
  `.env.${mode}.local`,
];

function parseEnvFile(file) {
  const out = {};

  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[line.slice(0, eq).trim()] = value;
  }

  return out;
}

const env = {};

for (const name of ENV_FILES) {
  const file = path.join(root, name);
  if (fs.existsSync(file)) Object.assign(env, parseEnvFile(file));
}

// Real environment variables always win, exactly like Next.js does it.
Object.assign(env, process.env);

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_DEMO_ORG_ID',
];

const missing = REQUIRED.filter((key) => !String(env[key] || '').trim());

if (missing.length) {
  console.error('');
  console.error('  [check-env] Build stopped — missing required environment variables:');
  console.error('');
  console.error(`      ${missing.join('\n      ')}`);
  console.error('');
  console.error('  next build bakes these into the client bundle, so without them');
  console.error('  the app deploys but every API call and login fails.');
  console.error('');
  console.error(`  Create ${path.relative(path.join(root, '..'), path.join(root, `.env.${mode}.local`))} with:`);
  console.error('');
  console.error('      NEXT_PUBLIC_API_URL=https://onewaynepal.com/chat-api');
  console.error('      NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co');
  console.error('      NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>');
  console.error('      NEXT_PUBLIC_DEMO_ORG_ID=<organization id powering the demo widget>');
  console.error('');
  console.error('  (.env*.local is gitignored — git pull will never bring it along.)');
  console.error('');
  process.exit(1);
}

console.log(
  `[check-env] ok — API ${env.NEXT_PUBLIC_API_URL} | Supabase ${env.NEXT_PUBLIC_SUPABASE_URL}`
);
