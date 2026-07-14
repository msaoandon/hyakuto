import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  transpilePackages: ['@hyakuto/engine', '@hyakuto/game', '@hyakuto/content', '@hyakuto/player-save'],
};

export default nextConfig;
