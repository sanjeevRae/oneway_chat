/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output → build locally (CloudLinux can't run the build) and
  // upload .next/standalone to cPanel. Keeps the Pages Router intact.
  output: 'standalone',
  // Serve the app under /chat on the production domain.
  basePath: '/chat',
  images: {
    // This VPS has no `sharp`, so Next's on-demand image optimizer answers
    // 400 Bad Request for every /_next/image request. Disabling the optimizer
    // makes next/image serve the file straight from /public instead.
    //
    // CAVEAT: with `unoptimized`, next/image does NOT prepend `basePath` to the
    // URL (see next/dist/shared/lib/get-img-props.js → generateImgAttrs), so an
    // <Image src="/x.png" /> would request /x.png instead of /chat/x.png.
    // The landing page therefore uses plain <img> with the basePath taken from
    // useRouter() — see pages/index.js. If you add next/image later, prefix the
    // src with basePath yourself.
    unoptimized: true,
  },
};

module.exports = nextConfig;
