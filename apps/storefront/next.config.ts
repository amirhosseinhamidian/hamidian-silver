import type { NextConfig } from 'next';

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

const nextConfig: NextConfig = {
  experimental: { globalNotFound: true },
  ...(e2eMode ? { distDir: '.next-e2e' } : {}),
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86_400,
    remotePatterns: [mediaRemotePattern(mediaPublicBaseUrl)],
    dangerouslyAllowLocalIP: process.env.STOREFRONT_E2E_ALLOW_LOCAL_MEDIA === 'true',
  },
};

export default nextConfig;
