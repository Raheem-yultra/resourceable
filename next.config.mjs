/** @type {import('next').NextConfig} */

// Baseline hardening headers applied to every response. Deliberately NO strict
// Content-Security-Policy here — Next.js relies on inline/runtime scripts and a
// wrong CSP silently breaks the app; that needs its own tested rollout. These
// headers are safe and non-breaking.
const securityHeaders = [
  // Force HTTPS for 2 years (incl. subdomains). Harmless locally (browsers
  // ignore HSTS on http://localhost).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Clickjacking: this app is never meant to be embedded in a frame.
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Stop MIME sniffing.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak full URLs (which can carry query params) to other origins.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Drop powerful features the app doesn't use.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  // The app does not use next/image with external hosts, so the image optimizer
  // must NOT be allowed to proxy arbitrary remote hosts (SSRF / bandwidth abuse).
  // Leaving remotePatterns empty disables external-host optimization. If you later
  // serve remote images (e.g. Supabase Storage), add that specific host here.
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
