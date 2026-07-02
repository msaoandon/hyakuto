import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VnNarration } from "./VnNarration";

// A VN scene *without* character speech: narrator prose. No name, no avatar —
// italic, muted text distinct from a speech caption.
const meta = {
  title: "VN/VnNarration",
  component: VnNarration,
  tags: ["autodocs"],
  args: {
    text: "The last of the daylight drained from the paper walls. Somewhere below, a single lantern still burned.",
  },
} satisfies Meta<typeof VnNarration>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Narration: Story = {};
