import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ChoiceModal } from "./ChoiceModal";

// The choice UI: a bottom-sheet overlay of the player's reply options. It's a
// `fixed inset-0` overlay, so these stories use fullscreen layout and let it fill
// the frame. Handlers are spies — click an option to see them fire in Actions.
const meta = {
  title: "Chat/ChoiceModal",
  component: ChoiceModal,
  parameters: { layout: "fullscreen" },
  args: { onChoose: fn(), onClose: fn() },
} satisfies Meta<typeof ChoiceModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two options — the common branch. */
export const TwoOptions: Story = {
  args: {
    options: [{ text: "Stay and light another candle." }, { text: "Leave before it's too late." }],
  },
};

/** A fuller set — the sheet grows with the options and scrolls if needed. */
export const FourOptions: Story = {
  args: {
    options: [
      { text: "Tell them the truth." },
      { text: "Change the subject." },
      { text: "Say nothing." },
      { text: "Ask about the ninth lantern." },
    ],
  },
};
