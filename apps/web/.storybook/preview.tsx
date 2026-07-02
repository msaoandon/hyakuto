import type { Preview } from "@storybook/nextjs-vite";
// The app's global stylesheet — brings Tailwind and the game's colour theme
// (`--color-silver`, `beige`, `gold`, …) so components render exactly as they
// do in the app.
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
  },
  // The game is a dark UI; canvas defaults to the app's near-black backdrop so
  // components sit on their real background instead of Storybook's white.
  decorators: [
    (Story) => (
      <div style={{ background: "#14191c", padding: "2rem", minWidth: "24rem" }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
