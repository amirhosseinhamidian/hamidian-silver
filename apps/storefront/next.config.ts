import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@hamidian/ui',
    '@hamidian/types',
    '@hamidian/api-client',
    '@hamidian/locale',
  ],
};

export default nextConfig;
