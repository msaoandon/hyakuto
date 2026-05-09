import type { GameState } from '../state/game-state';

export interface PoolVariant {
  idx: number;
  text: string;
  weight: number;
}

/**
 * Select a variant from a message pool.
 * 
 * If this message already has a recorded selection, return that.
 * Otherwise: unseen-first weighted sampling.
 * When all variants have been seen, reset and resample.
 */
export function selectFromPool(
  messageId: string,
  pool: PoolVariant[],
  state: GameState,
): PoolVariant {
  // Already selected this playthrough — return the same one
  if (messageId in state.poolSelections) {
    const idx = state.poolSelections[messageId];
    const variant = pool.find(v => v.idx === idx);
    if (!variant) {
      throw new Error(`Pool "${messageId}": recorded idx ${idx} not found in pool variants`);
    }
    return variant;
  }

  // Find unseen variants
  const seenIdxs = getSeenIdxs(messageId, state);
  let candidates = pool.filter(v => !seenIdxs.has(v.idx));

  // All seen — reset and use full pool
  if (candidates.length === 0) {
    candidates = pool;
  }

  // Exactly one unseen — deterministic
  if (candidates.length === 1) {
    const chosen = candidates[0];
    state.poolSelections[messageId] = chosen.idx;
    return chosen;
  }

  // Weighted random from candidates
  const chosen = weightedRandom(candidates);
  state.poolSelections[messageId] = chosen.idx;
  return chosen;
}

function weightedRandom(variants: PoolVariant[]): PoolVariant {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const variant of variants) {
    roll -= variant.weight;
    if (roll <= 0) return variant;
  }

  // Fallback (shouldn't reach here)
  return variants[variants.length - 1];
}

/**
 * Get the set of pool variant idxs the player has seen across all playthroughs.
 * For now, poolSelections only tracks the current playthrough.
 * Multi-playthrough seen history is a Phase 3 persistence concern.
 */
function getSeenIdxs(messageId: string, state: GameState): Set<number> {
  const seen = new Set<number>();
  if (messageId in state.poolSelections) {
    seen.add(state.poolSelections[messageId]);
  }
  return seen;
}
