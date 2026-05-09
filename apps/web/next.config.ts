import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  transpilePackages: ['@hyakuto/engine', '@hyakuto/game', '@hyakuto/content'],
};

export default nextConfig;
