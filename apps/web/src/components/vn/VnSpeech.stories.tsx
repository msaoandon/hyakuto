import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VnSpeech } from "./VnSpeech";

// A VN scene *with* character speech: a styled, named caption. The speaker's name
// takes their design colour; MC speaks as "You". (Narrator prose — a scene with no
// speaker — is VnNarration.)
const meta = {
  title: "VN/VnSpeech",
  component: VnSpeech,
  tags: ["autodocs"],
  args: {
    character: "kou",
    text: "You came back. I wasn't sure you would.",
    isMC: false,
  },
  argTypes: {
    character: {
      control: "select",
      options: ["ao", "kou", "haruki", "tatsumi", "ren", "suzune"],
    },
  },
} satisfies Meta<typeof VnSpeech>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A named character speaking. */
export const Character: Story = {};

/** MC's own line — the name renders as "You". */
export const MC: Story = {
  args: { isMC: true, text: "I said I would, didn't I?" },
};
