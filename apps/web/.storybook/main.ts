import type { StorybookConfig } from "@storybook/nextjs-vite";
import { fileURLToPath } from "node:url";

// Storybook for the player app. Uses the Vite-based Next framework — the repo is
// already Vite/Vitest-native, so this shares the same toolchain (Tailwind via the
// app's PostCSS, the `@/*` alias, workspace packages) rather than bolting on webpack.
const config: StorybookConfig = {
  // Co-located: each `*.stories.tsx` lives next to the component it documents.
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  // Serve the app's public assets so avatars/stickers/scenes resolve at their
  // real runtime paths (e.g. `/avatars/kou.jpg`).
  staticDirs: ["../public"],
  viteFinal: (viteConfig) => {
    // Mirror the tsconfig `@/*` -> `src/*` alias (same as vitest.config.ts) so
    // stories can import app modules by their production path.
    viteConfig.resolve ??= {};
    viteConfig.resolve.alias = {
      ...viteConfig.resolve.alias,
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    };
    return viteConfig;
  },
};

export default config;
