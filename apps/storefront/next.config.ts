import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const DEFAULT_MEDIA_PUBLIC_BASE_URL = 'http://localhost:3000/media';

function mediaRemotePattern(value: string) {
  const url = new URL(value);

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(
      'MEDIA_PUBLIC_BASE_URL must be an HTTP(S) URL without credentials, query, or fragment.',
    );
  }

  const pathname = url.pathname.replace(/\/+$/, '');

  return {
    protocol: url.protocol.slice(0, -1) as 'http' | 'https',
    hostname: url.hostname,
    port: url.port,
    pathname: `${pathname || ''}/**`,
  };
}

const mediaPublicBaseUrl =
  process.env.MEDIA_PUBLIC_BASE_URL?.trim() || DEFAULT_MEDIA_PUBLIC_BASE_URL;
const e2eMode = process.env.STOREFRONT_E2E === 'true';

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self';" },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
] as const;

const nextConfig: NextConfig = {
  experimental: { globalNotFound: true },
  poweredByHeader: false,
  async redirects() {
    // Exact legacy URLs observed in Search Console. Keep unrelated missing URLs as 404s.
    return [
      {
        source: '/products/products/athena-gold-silver-chain-45cm-model-2',
        destination: '/products/athena-gold-silver-chain-45cm-model-2',
        permanent: true,
      },
      {
        source: `/guide\\:${encodeURIComponent('دانستنی‌ها')}`,
        destination: '/guide',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...SECURITY_HEADERS],
      },
      {
        source: '/campaign-preview',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
  ...(e2eMode ? { distDir: '.next-e2e' } : {}),
  output: 'standalone',
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  images: {
    formats: ['image/avif', 'image/webp'],
    // Media URLs are immutable (replacement creates a new UUID-backed URL), so
    // optimized variants can stay cached for a month without serving stale images.
    minimumCacheTTL: 2_592_000,
    remotePatterns: [mediaRemotePattern(mediaPublicBaseUrl)],
    dangerouslyAllowLocalIP: process.env.STOREFRONT_E2E_ALLOW_LOCAL_MEDIA === 'true',
  },
};

export default nextConfig;
