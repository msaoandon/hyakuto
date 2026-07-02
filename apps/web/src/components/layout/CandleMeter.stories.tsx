import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CandleMeter } from "./CandleMeter";
import { useGameStore } from "@/store/gameStore";

// The persistent 🕯 candle count shown in every ongoing-game header. It reads the
// committed save's `candles` counter, so these stories seed that counter and render
// the real component. (The candle-*extinguish* animation — lit → guttering → out —
// is a Phase 5 polish item; Phase 2 ships only this durable count.)
type CandleArgs = { candles: number };

const meta = {
  title: "Layout/CandleMeter",
  component: CandleMeter,
  tags: ["autodocs"],
  argTypes: { candles: { control: { type: "range", min: 0, max: 100, step: 1 } } },
  args: { candles: 100 },
  render: ({ candles }) => {
    // Seed the committed save's candle counter, then render the real component,
    // which reads it via the store selector.
    useGameStore.setState((s) => ({
      save: { ...s.save, counters: { ...s.save.counters, candles } },
    }));
    return <CandleMeter />;
  },
} satisfies Meta<CandleArgs>;

export default meta;
type Story = StoryObj<CandleArgs>;

/** Start of the game — all lanterns lit. */
export const Full: Story = { args: { candles: 100 } };

/** Mid-game. */
export const Half: Story = { args: { candles: 50 } };

/** Almost out — the tense end-game count. */
export const Low: Story = { args: { candles: 3 } };

/** Extinguished — zero candles remaining. */
export const Out: Story = { args: { candles: 0 } };
