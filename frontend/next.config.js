/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output → build locally (CloudLinux can't run the build) and
  // upload .next/standalone to cPanel. Keeps the Pages Router intact.
  output: 'standalone',
  // Serve the app under /chat on the production domain.
  basePath: '/chat',
  images: {
    // The VPS runs the standalone server without `sharp`, so Next's on-demand
    // image optimizer answers 400 Bad Request for every /_next/image request
    // (that is why the landing-page images failed to load). Serving the images
    // straight from /public avoids the optimizer entirely.
    unoptimized: true,
  },
};

module.exports = nextConfig;
