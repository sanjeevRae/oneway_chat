/**
 * Post-build helper for `output: 'standalone'`.
 *
 * Next.js deliberately does NOT copy `public/` or `.next/static/` into
 * `.next/standalone/` — the docs tell you to copy them by hand before
 * deploying. That step is easy to forget, and forgetting it is exactly why
 * the landing-page images (logo, hero, rocket, faq, cta icons) stopped
 * loading: every `next build` wipes `.next/standalone/public`.
 *
 * This script runs automatically after `npm run build` (the `postbuild` npm
 * hook), so `.next/standalone/` is always a complete, uploadable bundle.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const standalone = path.join(root, '.next', 'standalone');

const COPIES = [
  { from: path.join(root, 'public'), to: path.join(standalone, 'public') },
  {
    from: path.join(root, '.next', 'static'),
    to: path.join(standalone, '.next', 'static'),
  },
];

if (!fs.existsSync(standalone)) {
  console.log(
    '[postbuild] .next/standalone not found — skipped (is output:"standalone" set?).'
  );
  process.exit(0);
}

for (const { from, to } of COPIES) {
  const label = path.relative(root, from);

  if (!fs.existsSync(from)) {
    console.log(`[postbuild] skipped (missing): ${label}`);
    continue;
  }

  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(
    `[postbuild] copied ${label} -> ${path.relative(root, to)}`
  );
}

console.log('[postbuild] .next/standalone is ready to upload.');
