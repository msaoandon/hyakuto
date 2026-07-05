import type { NextConfig } from "next";

// Dev-only authoring tool. Unlike apps/web (a static Capacitor export), the CMS
// runs a Node server so its Server Actions can drive FileProjectStore — so NO
// `output: 'export'` here. The workspace TS packages ship raw source, so Next
// transpiles them.
const nextConfig: NextConfig = {
  transpilePackages: [
    "@hyakuto/engine",
    "@hyakuto/game",
    "@hyakuto/content",
    "@hyakuto/cms-core",
  ],
};

export default nextConfig;
