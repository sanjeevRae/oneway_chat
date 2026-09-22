// Public landing page — shown before login.
// All sections built: Hero, About, Features, CTA, Footer.

import Link from 'next/link';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments } from '@fortawesome/free-solid-svg-icons';

function ArrowUpRightIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

function About() {
  return (
    <section id="about" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Heading + intro copy */}
        <h2 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">About the tool</h2>

        <div className="mt-6 max-w-3xl space-y-4 text-[15px] leading-relaxed text-ink-500">
          <p>
            OneWayChat builds AI chat assistants that help your customers and visitors
            get instant answers from your own content — your website, documents and
            FAQs. It works as an embeddable widget on any site or as a direct chat link.
          </p>
          <p>
            Many questions would otherwise require digging through long documents and
            pages of text. OneWayChat answers in seconds and points to the source,
            bringing real efficiency to your support, sales and day-to-day queries —
            around the clock.
          </p>
        </div>

        {/* Bento grid */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-12">
          {/* Smart AI Search — big card with screenshot placeholder */}
          <div className="flex flex-col rounded-2xl bg-gray-100 p-7 sm:col-span-2 sm:p-8 lg:col-span-5 lg:row-span-2">
            <h3 className="flex items-center gap-1.5 text-2xl font-bold text-brand-600">
              Smart AI Search
              <ArrowUpRightIcon />
            </h3>
            <div className="mt-6 flex min-h-[240px] flex-1 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white/70 p-6 text-center">
              <span className="text-sm text-ink-400">
                Screenshot placeholder
                <br />
                (add your image here)
              </span>
            </div>
          </div>

          {/* Keep Track & History — chat bubbles */}
          <div className="rounded-2xl bg-brand-50 p-7 lg:col-span-4">
            <h3 className="text-xl font-bold text-ink-900">Keep Track &amp; History</h3>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl bg-white p-3.5 text-[13px] leading-snug text-ink-700 shadow-sm">
                <FontAwesomeIcon icon={["fas", "comments"]} className="mr-1.5 text-ink-400" /> Give me a list of my appointments from this week
              </div>
              <div className="rounded-xl bg-white p-3.5 text-[13px] leading-snug text-ink-700 shadow-sm">
                <FontAwesomeIcon icon={["fas", "comments"]} className="mr-1.5 text-ink-400" /> How can I book a service at your business?
              </div>
            </div>
          </div>

          {/* Fast & Smooth Response — tall card, illustration placeholder */}
          <div className="relative flex flex-col rounded-2xl border border-gray-100 bg-white p-7 lg:col-span-3 lg:row-span-2">
            <h3 className="text-xl font-bold text-ink-900">Fast &amp; Smooth Response</h3>
            <div className="mt-5 flex-1 relative">
              <Image
                src="/components/rocket.png"
                alt="Rocket illustration"
                width={200}
                height={176}
                className="absolute right-[24px] bottom-0 z-10 object-contain -mr-[80px]"
                priority
              />
            </div>
          </div>

          {/* Informative & Insightful Data */}
          <div className="rounded-2xl bg-brand-100 p-7 lg:col-span-4">
            <h3 className="text-xl font-bold text-ink-900">Informative &amp; Insightful Data</h3>
           
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
  return (
    <section id="hero" className="relative overflow-hidden bg-white">
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-14 sm:pt-20 lg:grid-cols-[58%_42%] lg:gap-0">
        {/* Left — headline, subtext, ask bar */}
        <div>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-ink-900 sm:text-[44px] sm:leading-[1.12]">
            AI Chat Assistant
            <br />
            for your business
            <br />
            knowledge base
          </h1>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-500">
            OneWayChat builds AI chatbots that answer your customers from your own
            content — your website, documents and FAQs. Embed it on any site or
            share it as a direct chat link.
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

        {/* Right — image placeholder (add your image here) */}
        <div className="relative flex items-center justify-center py-6 lg:py-0 lg:max-w-[40%]">
          <div
            aria-hidden="true"
            className="absolute h-72 w-72 rounded-full bg-brand-50 sm:h-96 sm:w-96 lg:hidden lg:w-[40%] lg:h-[40%]"
          />
          <div className="relative flex h-full max-w-full items-center justify-center rounded-3xl border-2 border-dashed border-brand-300 bg-white/70 text-center sm:h-96 sm:w-96 lg:h-[40%] lg:w-full overflow-hidden">
            <Image
              src="/components/hero.webp"
              alt="Hero illustration"
              fill
              className="object-contain"
              priority
            />
          </div>
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
    body: 'This bot answers your customers instantly from your own knowledge base — website pages, documents and FAQs. Response within seconds removes long waiting times, and the answers are precise and well-presented for quick understanding. Your team can easily add or edit the data the bot learns from.',
    cta: 'Try Support Bot',
  },
  {
    title: 'Appointments & Bookings Bot',
    body: 'The bot books appointments automatically when customers ask — capturing the time, party details and contact information. Bookings appear in your dashboard where you can confirm, complete or cancel them, and every booking is tracked in your monthly usage.',
    cta: 'Try Booking Bot',
  },
  {
    title: 'Lead Capture Bot',
    body: 'When a visitor shares their name, phone or email in chat, the bot captures it as an inquiry. Leads are collected in your dashboard with contact details and notes, so nothing slips through — even outside business hours, every conversation becomes a potential customer.',
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
    icon: '🧩',
    bg: 'bg-gray-100',
    title: 'Instant Customer Support',
    body: 'Answer common questions instantly and give customers helpful information without making them wait for your team.',
  },
  {
    icon: '📄',
    bg: 'bg-brand-50',
    title: 'Capture More Leads',
    body: 'Turn website visitors and conversations into qualified leads by collecting the right information at the right time.',
  },
  {
    icon: '💡',
    bg: 'bg-brand-100',
    title: 'Automate Repetitive Work',
    body: 'Handle routine conversations, inquiries, bookings, and other repetitive tasks automatically so your team can focus on what matters.',
  },
];

function Cta() {
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
                <div className="text-4xl" aria-hidden="true">{card.icon}</div>
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
    </main>
  );
}

