/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output → build locally (CloudLinux can't run the build) and
  // upload .next/standalone to cPanel. Keeps the Pages Router intact.
  output: 'standalone',
  // Serve the app under /chat on the production domain.
  basePath: '/chat',
};

module.exports = nextConfig;
