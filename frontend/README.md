# OneWayChat — Frontend

Next.js 14 + Tailwind dashboard and marketing site for the OneWayChat platform.
Deployed on a **VPS / cPanel** as a Next.js *standalone* server under `/chat`.

## Pages
| Route | Description |
|---|---|
| `/` | Marketing landing page (Hero, About, Features, CTA, Footer) |
| `/signup` | Create account (+ auto-creates org via DB trigger) |
| `/login` | Log in |
| `/dashboard` | Stats, test chat, install snippet & direct link |
| `/train` | Train the bot: crawl / upload / manual text |
| `/appointments` | View & manage bot-made appointments |
| `/inquiries` | Captured inquiries |
| `/inbox` | Conversations inbox |
| `/settings` | Business details, bot personality & welcome message |
| `/admin` | Admin panel |

## Local Setup
```bash
cd frontend
npm install
cp .env.example .env.local   # fill in Supabase + backend URL
npm run dev                  # http://localhost:3000
```

## Linking to the Backend
The frontend talks to the Express backend on the VPS through `NEXT_PUBLIC_API_URL`.
All authenticated requests attach the Supabase JWT automatically (`lib/supabaseClient.js`).

## Deploy to the VPS (git pull + standalone)
`next.config.js` uses `output: 'standalone'` and `basePath: '/chat'`, so the app
is served from `https://onewaynepal.com/chat`. The build happens on the VPS.

### One-time: create the production env file
`.env*.local` is **gitignored**, so `git pull` never brings it along. On a fresh
clone the build would otherwise bake in `undefined` for the API URL and Supabase
keys. Create it once, next to `package.json`:

```bash
cd /path/to/oneway_chat/frontend
cat > .env.production.local <<'EOF'
NEXT_PUBLIC_API_URL=https://onewaynepal.com/chat-api
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon public key>
EOF
```

### Every deploy
```bash
cd /path/to/oneway_chat && git pull
cd frontend && npm ci && npm run build
# then restart the Node app: pm2 restart onewaychat  (or cPanel → Restart)
```

The restart must run `node .next/standalone/server.js` — that file `chdir`s to
its own folder, so `public/` has to live inside `.next/standalone/`.

Three scripts run as part of the build:

| Hook | Script | Why it exists |
|---|---|---|
| `prebuild` | `scripts/check-env.js` | Aborts with a clear message if the `NEXT_PUBLIC_*` vars are missing, instead of silently shipping a broken bundle |
| `build` | `next build` | Writes `.next/standalone/` |
| `postbuild` | `scripts/postbuild.js` | Copies `public/` and `.next/static/` into `.next/standalone/` — Next.js never does this itself, and without it every image and every JS/CSS file 404s |

> **Why it matters:** `next build` wipes `.next/standalone/`. If `public/` is not
> copied back in, the landing-page images (and all CSS/JS) silently disappear.

## Images
Landing-page images live in `public/components/` and are rendered with
`next/image` + `unoptimized` (plus `images.unoptimized: true` in
`next.config.js`). The VPS standalone server has no `sharp`, so Next's
on-demand image optimizer answers `400 Bad Request` for `/_next/image?...`.
Serving the files straight from `public/` sidesteps the optimizer entirely.
