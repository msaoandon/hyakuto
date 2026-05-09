import { describe, it, expect } from 'vitest';
import { parseCondition, evaluateCondition } from '../src/conditions/parser';
import { createGameState } from '../src/state/game-state';
import type { GameConfig } from '../src/schemas/game-config';

const config: GameConfig = {
  axes: ['story', 'tatsumi_closeness', 'mio_closeness'],
  characters: [{ id: 'ao', typing_rate: 1.0 }],
  counters: [{ id: 'candles', start: 100, end: 0, direction: 'down' }],
};

function stateWith(overrides: {
  axes?: Record<string, number>;
  counters?: Record<string, number>;
  flags?: string[];
}) {
  const state = createGameState(config);
  if (overrides.axes) Object.assign(state.axes, overrides.axes);
  if (overrides.counters) Object.assign(state.counters, overrides.counters);
  if (overrides.flags) overrides.flags.forEach(f => state.flags.add(f));
  return state;
}

describe('parseCondition', () => {
  it('parses simple comparison', () => {
    expect(() => parseCondition('story > 4')).not.toThrow();
  });

  it('parses comparison without spaces', () => {
    expect(() => parseCondition('story>4')).not.toThrow();
  });

  it('parses flag', () => {
    expect(() => parseCondition('flag:third_path_unlocked')).not.toThrow();
  });

  it('parses NOT flag', () => {
    expect(() => parseCondition('NOT flag:ko_confronted')).not.toThrow();
  });

  it('parses AND expression', () => {
    expect(() => parseCondition('story >= 5 AND candles <= 40')).not.toThrow();
  });

  it('parses OR expression', () => {
    expect(() => parseCondition('story > 3 OR mio_closeness > 5')).not.toThrow();
  });

  it('parses parenthesized expression', () => {
    expect(() => parseCondition('(story > 3 OR mio_closeness > 5) AND candles <= 40')).not.toThrow();
  });

  it('throws on malformed expression', () => {
    expect(() => parseCondition('story >')).toThrow();
  });

  it('throws on unknown characters', () => {
    expect(() => parseCondition('story @ 4')).toThrow();
  });
});

describe('evaluateCondition', () => {
  it('evaluates simple greater than', () => {
    const state = stateWith({ axes: { story: 5 } });
    expect(evaluateCondition('story > 4', state)).toBe(true);
    expect(evaluateCondition('story > 5', state)).toBe(false);
  });

  it('evaluates greater than or equal', () => {
    const state = stateWith({ axes: { story: 5 } });
    expect(evaluateCondition('story >= 5', state)).toBe(true);
    expect(evaluateCondition('story >= 6', state)).toBe(false);
  });

  it('evaluates less than', () => {
    const state = stateWith({ axes: { mio_closeness: 3 } });
    expect(evaluateCondition('mio_closeness < 5', state)).toBe(true);
    expect(evaluateCondition('mio_closeness < 3', state)).toBe(false);
  });

  it('evaluates without spaces', () => {
    const state = stateWith({ axes: { story: 5 } });
    expect(evaluateCondition('story>4', state)).toBe(true);
  });

  it('evaluates counter values', () => {
    const state = stateWith({ counters: { candles: 35 } });
    expect(evaluateCondition('candles <= 40', state)).toBe(true);
    expect(evaluateCondition('candles <= 30', state)).toBe(false);
  });

  it('evaluates flag set', () => {
    const state = stateWith({ flags: ['third_path_unlocked'] });
    expect(evaluateCondition('flag:third_path_unlocked', state)).toBe(true);
    expect(evaluateCondition('flag:other_flag', state)).toBe(false);
  });

  it('evaluates NOT flag', () => {
    const state = stateWith({ flags: [] });
    expect(evaluateCondition('NOT flag:ko_confronted', state)).toBe(true);
  });

  it('evaluates AND', () => {
    const state = stateWith({ axes: { tatsumi_closeness: 7 }, counters: { candles: 35 } });
    expect(evaluateCondition('tatsumi_closeness >= 6 AND candles <= 40', state)).toBe(true);
    expect(evaluateCondition('tatsumi_closeness >= 8 AND candles <= 40', state)).toBe(false);
  });

  it('evaluates OR', () => {
    const state = stateWith({ axes: { story: 2, mio_closeness: 6 } });
    expect(evaluateCondition('story > 5 OR mio_closeness > 5', state)).toBe(true);
    expect(evaluateCondition('story > 5 OR mio_closeness > 10', state)).toBe(false);
  });

  it('evaluates parenthesized expressions', () => {
    const state = stateWith({ axes: { story: 2, mio_closeness: 6 }, counters: { candles: 35 } });
    expect(evaluateCondition('(story > 5 OR mio_closeness > 5) AND candles <= 40', state)).toBe(true);
    expect(evaluateCondition('(story > 5 OR mio_closeness > 5) AND candles <= 30', state)).toBe(false);
  });

  it('throws on unknown variable', () => {
    const state = stateWith({});
    expect(() => evaluateCondition('nonexistent > 5', state)).toThrow('Unknown variable');
  });
});
