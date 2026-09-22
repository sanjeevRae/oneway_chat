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

## Deploy to the VPS (cPanel / standalone)
`next.config.js` uses `output: 'standalone'` and `basePath: '/chat'`.

1. `npm run build` — Next.js writes `.next/standalone/`, then the `postbuild`
   hook (`scripts/postbuild.js`) copies `public/` and `.next/static/` into it.
   Next.js does **not** copy those itself; without them every image and every
   JS/CSS file 404s.
2. Upload the rebuilt `.next/standalone/` (or a fresh zip of `.next`) and
   restart the Node app — it runs `.next/standalone/server.js`.

> **Rebuilding?** `next build` wipes `.next/standalone/`, so the images from
> `public/` disappear until `postbuild` puts them back. Always re-upload the
> whole `.next/standalone/` folder — never an older archive, or the images and
> styles silently go missing.

## Images
Landing-page images live in `public/components/` and are rendered with
`next/image` + `unoptimized` (plus `images.unoptimized: true` in
`next.config.js`). The VPS standalone server has no `sharp`, so Next's
on-demand image optimizer answers `400 Bad Request` for `/_next/image?...`.
Serving the files straight from `public/` sidesteps the optimizer entirely.
