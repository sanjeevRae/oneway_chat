// Public landing page — shown before login.
// All sections built: Hero, About, Features, CTA, Footer.

import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';

function ArrowUpRightIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

// Bootstrap Icons "bi bi-chat", inlined as a component so there is no icon
// library import and no runtime registration step that can silently fail.
function ChatIcon({ className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      className={`inline-block align-[-0.125em] ${className}`.trim()}
      aria-hidden="true"
    >
      <path d="M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105" />
    </svg>
  );
}

function About() {
  const { basePath } = useRouter();

  return (
    <section id="about" className="overflow-x-clip bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Heading + intro copy */}
        <h2 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">About the tool</h2>

        <div className="mt-6 max-w-4xl space-y-4 text-[15px] leading-relaxed text-ink-500">
          <p>
           OneWayChat gives your business an AI chat assistant that answers customers
           instantly using your own knowledge including your website, documents, FAQs,
           and more. Add it to any website with an easy-to-embed widget or share it
           through a direct chat link.
          </p>
          <p>
            Instead of making customers search through pages of information, OneWayChat
            delivers clear answers in seconds and can point back to the relevant source.
             Keep support, sales, and everyday customer questions moving 24/7 with an
             AI assistant built around your business.
          </p>
        </div>

        {/* Bento grid */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-12">
          {/* Manage Everything */}
          <div className="relative flex flex-col rounded-2xl bg-gray-100 p-7 sm:col-span-2 sm:p-8 lg:col-span-5 lg:row-span-2">
            <h3 className="flex items-center gap-1.5 text-2xl font-bold text-brand-600">
              Manage Everything
              <ArrowUpRightIcon />
            </h3>
            <div className="absolute bottom-0 right-0 h-[260px] w-full">
              <img
                src={`${basePath}/components/dashboard.png`}
                alt="Dashboard screenshot"
                className="h-full w-full object-contain object-bottom"
              />
            </div>
          </div>

          {/* Keep Track & History — chat bubbles */}
          <div className="rounded-2xl bg-[#D4DFFE] p-7 lg:col-span-4">
            <h3 className="text-xl font-bold text-ink-900">Helpful Responses</h3>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl bg-white p-3.5 text-[13px] leading-snug text-ink-700 shadow-sm">
                <ChatIcon className="mr-1.5 text-ink-400" /> I’d like to schedule an appointment.
              </div>
              <div className="rounded-xl bg-white p-3.5 text-[13px] leading-snug text-ink-700 shadow-sm">
                <ChatIcon className="mr-1.5 text-ink-400" /> What services do you offer?
              </div>
            </div>
          </div>

          {/* Fast & Reliable Answers — rocket straddling the card's right edge:
              h-[110%] overflows slightly above the wrapper (bottom-anchored) for
              extra size; -translate-x-[60%] places 60% of the image inside the
              card and 40% outside. The heading sits above it via z-20. */}
          <div className="relative flex flex-col rounded-2xl bg-[#FEEFDB] p-7 lg:col-span-3 lg:row-span-2">
            <h3 className="relative z-20 text-xl font-bold text-ink-900">Fast &amp; Reliable Answers</h3>
            <div className="relative -mr-7 mt-5 flex-1">
              <img
                src={`${basePath}/components/rocket.png`}
                alt="Rocket illustration"
                width="240"
                height="240"
                className="absolute bottom-0 left-full z-10 h-[110%] w-auto max-w-none -translate-x-[60%] object-contain"
              />
            </div>
          </div>

          {/* Informative & Insightful Data — FAQ image flows under the text */}
          <div className="relative flex flex-col rounded-2xl bg-brand-100 p-7 lg:col-span-4">
            <h3 className="text-xl font-bold text-ink-900">Intelligent &amp;  <br />  Helpful Responses</h3>
            <div className="mt-auto flex justify-end pt-4">
              <img
                src={`${basePath}/components/faq.png`}
                alt="FAQ illustration"
                className="h-16 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-400" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function Hero() {
  const { basePath } = useRouter();

  return (
    <section id="hero" className="relative overflow-hidden bg-white">
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-14 sm:pt-20 lg:grid-cols-[58%_42%] lg:gap-0">
        {/* Left — headline, subtext, ask bar */}
        <div>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-ink-900 sm:text-[44px] sm:leading-[1.12]">
            Make AI Your Business’s Always-On Assistant
            <br />
            Always-On Assistant
          </h1>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-500">
           OneWayChat helps businesses turn their knowledge into intelligent AI conversations that improve customer support, automate repetitive tasks, and drive more engagement.
          </p>

          <form
            className="mt-9 flex max-w-md items-center gap-3 rounded-full border border-gray-200 bg-white py-3.5 pl-5 pr-3 shadow-sm transition-colors focus-within:border-brand-500"
            onSubmit={(e) => e.preventDefault()}
          >
            <SearchIcon />
            <input
              type="text"
              placeholder="Ask something…"
              aria-label="Ask something"
              className="w-full bg-transparent text-sm text-ink-700 outline-none placeholder:text-ink-400"
            />
          </form>
        </div>

        {/* Right — hero illustration, bleeds to the screen edge on desktop */}
        <div className="relative flex items-center justify-center py-6 lg:justify-end lg:py-0">
          <div
            aria-hidden="true"
            className="absolute h-72 w-72 rounded-full bg-brand-50 sm:h-96 sm:w-96 lg:hidden"
          />
          <img
            src={`${basePath}/components/hero.webp`}
            alt="Hero illustration"
            className="relative h-auto w-full max-w-lg object-contain sm:max-w-2xl lg:-mr-6 lg:w-[calc(100%+2.5rem)] lg:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

const FEATURES = [
  {
    title: 'Customer Support Bot',
    body: 'This bot answers your customers instantly from your own knowledge base website pages, documents and FAQs. Response within seconds removes long waiting times, and the answers are precise and well-presented for quick understanding. Your team can easily add or edit the data the bot learns from.',
    cta: 'Try Support Bot',
  },
  {
    title: 'Appointments & Bookings Bot',
    body: 'The bot books appointments automatically when customers ask capturing the time, party details and contact information. Bookings appear in your dashboard where you can confirm, complete or cancel them, and every booking is tracked in your monthly usage.',
    cta: 'Try Booking Bot',
  },
  {
    title: 'Lead Capture Bot',
    body: 'When a visitor shares their name, phone or email in chat, the bot captures it as an inquiry. Leads are collected in your dashboard with contact details and notes, so nothing slips through even outside business hours, every conversation becomes a potential customer.',
    cta: 'Try Leads Bot',
  },
];

function Features() {
  return (
    <section id="features" className="bg-gray-50 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* Heading */}
        <h2 className="text-center text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          Our Services Through AI
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-ink-500">
          OneWayChat provides several bot services for your business, trained on your own
          knowledge base. Try the different bots to see what they can do for your queries.
        </p>

        {/* Cards */}
        <div className="mt-12 space-y-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm sm:p-9"
            >
              <h3 className="text-xl font-bold text-ink-900 sm:text-2xl">{feature.title}</h3>
              <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-500 sm:text-sm">
                {feature.body}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full border border-brand-600 px-4 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-600 hover:text-white"
                >
                  {feature.cta}
                  <ArrowRightIcon />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
                >
                  <InfoIcon />
                  Learn more
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const CTA_CARDS = [
  {
    src: '/components/assistance.webp',
    bg: 'bg-gray-100',
    title: 'Instant Customer Support',
    body: 'Answer common questions instantly and give customers helpful information without making them wait for your team.',
  },
  {
    src: '/components/leads.webp',
    bg: 'bg-gray-100',
    title: 'Capture More Leads',
    body: 'Turn website visitors and conversations into qualified leads by collecting the right information at the right time.',
  },
  {
    src: '/components/queries.webp',
    bg: 'bg-gray-100',
    title: 'Automate Repetitive Work',
    body: 'Handle routine conversations, inquiries, bookings, and other repetitive tasks automatically so your team can focus on what matters.',
  },
];

function Cta() {
  const { basePath } = useRouter();

  return (
    <>
      {/* Value cards */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Your AI Assistant, Built for Business
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-ink-500">
            Turn conversations into useful actions. Your AI assistant answers customers, captures leads, handles common questions, and helps your team stay available around the clock.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {CTA_CARDS.map((card) => (
              <div key={card.title} className={`rounded-2xl px-7 py-10 text-center ${card.bg}`}>
                <div className="mx-auto mb-4 w-14">
                  <img
                    src={`${basePath}${card.src}`}
                    alt={card.title}
                    className="h-auto w-full"
                  />
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink-900">{card.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Green CTA band */}
      <section id="cta" className="relative overflow-hidden bg-brand-600">
        <div
          aria-hidden="true"
          className="absolute -left-40 top-1/2 h-[480px] w-[480px] -translate-y-1/2 rounded-full bg-brand-700/40"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-brand-500/40"
        />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to Try OneWayChat?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-brand-50">
            Let&apos;s sign up and try our conversational assistant to get ahead in
            ongoing projects or future goals.
          </p>
          <Link
            href="/signup"
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-transform hover:scale-[1.03]"
          >
            Try OneWayChat
            <ArrowRightIcon />
          </Link>
        </div>
      </section>
    </>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function Footer() {
  const linkCls =
    'text-sm text-gray-400 transition-colors hover:text-white';

  return (
    <footer id="footer" className="bg-gray-900">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:grid-cols-2 lg:grid-cols-5">
        {/* Brand */}
        <div className="lg:col-span-2">
          <span className="text-2xl font-bold tracking-tight text-white">OneWayChat</span>
          <p className="mt-5 text-sm leading-relaxed text-gray-400">
            Conversational AI Assistant
            <br />
            for your business
          </p>
        </div>

        {/* About Company */}
        <div>
          <h3 className="text-sm font-semibold text-white">About Company</h3>
          <ul className="mt-4 space-y-3">
            <li><Link href="/#about" className={linkCls}>About us</Link></li>
            <li><Link href="/#features" className={linkCls}>FAQ</Link></li>
          </ul>
        </div>

        {/* Important Links */}
        <div>
          <h3 className="text-sm font-semibold text-white">Important Links</h3>
          <ul className="mt-4 space-y-3">
            <li><Link href="https://onewaynepal.com/terms-and-conditions" className={linkCls}>Terms &amp; Conditions</Link></li>
            <li><Link href="https://onewaynepal.com/privacy-policy" className={linkCls}>Privacy Policy</Link></li>
            <li><Link href="/#" className={linkCls}>Contact us</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-sm font-semibold text-white">Give us a Call</h3>
          <ul className="mt-4 space-y-3 text-sm text-gray-400">
            <li className="flex items-center gap-2.5">
              <PhoneIcon />
              <span>+977-9828626238</span>
            </li>
          </ul>
          <h3 className="mt-6 text-sm font-semibold text-white">Email us at</h3>
          <a
            href="mailto:info@onewaynepal.com"
            className="mt-4 inline-flex items-center gap-2.5 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <MailIcon />
            <span>info@onewaynepal.com</span>
          </a>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-gray-400">
          © Copyright 2026. All Rights Reserved by OneWayChat
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main>
      <Hero />
      <About />
      <Features />
      <Cta />
      <Footer />

      {/* Live demo of the product itself: the same embeddable widget customers
          paste into their own sites. The script draws the bottom-right chat
          bubble, loads the welcome message from /api/chat/config/:orgId and
          talks to POST /api/chat. Uses lazyOnload so it never blocks LCP. */}
      {process.env.NEXT_PUBLIC_DEMO_ORG_ID ? (
        <Script
          src={`${String(process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')}/widget.js?org=${process.env.NEXT_PUBLIC_DEMO_ORG_ID}`}
          strategy="lazyOnload"
        />
      ) : null}
    </main>
  );
}

