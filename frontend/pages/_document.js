import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Gate for the scroll-reveal styles: without JS the class is never
            added, so the page content stays visible instead of hidden. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js-reveal')",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Favicon — path includes the app basePath ('/chat') since Next.js
            does not rewrite hrefs in _document. Prevents /favicon.ico 404. */}
        <link rel="icon" type="image/svg+xml" href="/chat/favicon.svg" />
        <link rel="mask-icon" href="/chat/favicon.svg" color="#059669" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
