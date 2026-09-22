// Public landing page — shown before login.
// Sections are intentional placeholders; design & copy to be added.

function Placeholder({ id, label }) {
  return (
    <section id={id} className="border-b border-dashed border-gray-200">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-6 py-24 text-center sm:py-32">
        <span className="chip">{label}</span>
        <p className="mt-3 text-sm text-ink-400">Placeholder — content coming soon.</p>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <Placeholder id="hero" label="Hero" />
      <Placeholder id="about" label="About" />
      <Placeholder id="features" label="Features" />
      <Placeholder id="cta" label="CTA" />
      <footer id="footer" className="border-b border-dashed border-gray-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
          <span className="chip">Footer</span>
          <p className="mt-3 text-sm text-ink-400">Placeholder — content coming soon.</p>
        </div>
      </footer>
    </main>
  );
}
