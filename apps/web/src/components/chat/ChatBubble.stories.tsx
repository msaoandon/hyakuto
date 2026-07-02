import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChatBubble } from "./ChatBubble";

// Every visual state of a single chat bubble. The bubble is purely presentational
// — it takes a character, text, and grouping/role flags and styles itself from
// that character's design. These stories are the reference catalog for those states.
const meta = {
  title: "Chat/ChatBubble",
  component: ChatBubble,
  tags: ["autodocs"],
  args: {
    character: "kou",
    text: "The lanterns are almost out. We should hurry.",
    showName: true,
    showAvatar: true,
    isFirst: true,
    isLast: true,
  },
  argTypes: {
    character: {
      control: "select",
      options: ["ao", "kou", "haruki", "tatsumi", "ren", "suzune"],
    },
    contentType: { control: "inline-radio", options: ["message", "sticker", "image"] },
  },
} satisfies Meta<typeof ChatBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single incoming message: avatar, name, and one rounded bubble. */
export const Incoming: Story = {};

/** MC's own reply — right-aligned, no avatar, the light "you" styling. */
export const Outgoing: Story = {
  args: { isMC: true, text: "Then let's not waste time." },
};

/** A dev-console echo — right-aligned like MC but tagged `dev`. */
export const DevMessage: Story = {
  args: { isDev: true, text: "advance(3)" },
};

// Consecutive messages from one character are grouped: only the first shows the
// name, only the last shows the avatar + tail, and the corners tighten between
// them. This story stacks the three positions to show the grouping treatment.
export const GroupedRun: Story = {
  args: { character: "tatsumi" },
  render: (args) => (
    <div className="flex flex-col gap-1">
      <ChatBubble {...args} text="Wait." isFirst isLast={false} showAvatar={false} />
      <ChatBubble
        {...args}
        text="Something moved past the shrine gate."
        isFirst={false}
        isLast={false}
        showName={false}
        showAvatar={false}
      />
      <ChatBubble
        {...args}
        text="Did you see it too?"
        isFirst={false}
        isLast
        showName={false}
      />
    </div>
  ),
};

/** Without name/avatar chrome — e.g. a mid-run bubble in a dense feed. */
export const Bare: Story = {
  args: { showName: false, showAvatar: false, isFirst: false, isLast: false },
};

/** A shared photo. Tapping it opens the image modal in the app (no-op here). */
export const SharedImage: Story = {
  args: { contentType: "image", file: "kou_dinner.jpg", text: "" },
};

/**
 * A sticker message. The layout is what's being documented — no sticker assets
 * are authored yet, so the image itself renders as a broken placeholder.
 */
export const Sticker: Story = {
  args: { contentType: "sticker", file: "wave.png", text: "" },
};
