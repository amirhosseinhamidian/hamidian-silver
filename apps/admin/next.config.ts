import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  experimental: { globalNotFound: true },
  output: 'standalone',
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
};

export default nextConfig;
