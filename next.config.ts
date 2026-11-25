import type { NextConfig } from 'next';

const config: NextConfig = {
  devIndicators: false,
  experimental: { serverComponentsHmrCache: false },
};

export default config;
