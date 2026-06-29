import { describe, it, expect } from 'vitest';
import { createGameState, applyEffect, setFlag, updateCounter } from '../src/state/game-state';
import { GameConfig } from '../src/schemas/game-config';

const testConfig: GameConfig = {
  axes: ['story', 'suspense', 'trust'],
  characters: [
    { id: 'ao', typing_rate: 1.0 },
    { id: 'kou', typing_rate: 0.6 },
  ],
  counters: [
    { id: 'candles', start: 100, end: 0, direction: 'down' },
  ],
};

describe('createGameState', () => {
  it('initializes axes to 0', () => {
    const state = createGameState(testConfig);
    expect(state.axes.story).toBe(0);
    expect(state.axes.suspense).toBe(0);
    expect(state.axes.trust).toBe(0);
  });

  it('initializes counters to start value', () => {
    const state = createGameState(testConfig);
    expect(state.counters.candles).toBe(100);
  });

  it('initializes flags as empty', () => {
    const state = createGameState(testConfig);
    expect(state.flags.size).toBe(0);
  });

  it('initializes pool selections as empty', () => {
    const state = createGameState(testConfig);
    expect(Object.keys(state.poolSelections)).toHaveLength(0);
  });

  it('defaults MC gender to unset', () => {
    const state = createGameState(testConfig);
    expect(state.gender).toBe('unset');
  });
});

describe('applyEffect', () => {
  it('applies positive delta', () => {
    const state = createGameState(testConfig);
    applyEffect(state, 'story', 1, testConfig.axes);
    expect(state.axes.story).toBe(1);
  });

  it('applies negative delta', () => {
    const state = createGameState(testConfig);
    applyEffect(state, 'story', -2, testConfig.axes);
    expect(state.axes.story).toBe(-2);
  });

  it('accumulates deltas', () => {
    const state = createGameState(testConfig);
    applyEffect(state, 'story', 3, testConfig.axes);
    applyEffect(state, 'story', -1, testConfig.axes);
    expect(state.axes.story).toBe(2);
  });

  it('throws on unknown axis', () => {
    const state = createGameState(testConfig);
    expect(() => applyEffect(state, 'nonexistent', 1, testConfig.axes))
      .toThrow('Unknown axis: "nonexistent"');
  });
});

describe('setFlag', () => {
  it('sets a valid flag', () => {
    const state = createGameState(testConfig);
    const validFlags = ['third_path_unlocked', 'ko_confronted'];
    setFlag(state, 'third_path_unlocked', validFlags);
    expect(state.flags.has('third_path_unlocked')).toBe(true);
  });

  it('throws on undeclared flag', () => {
    const state = createGameState(testConfig);
    expect(() => setFlag(state, 'not_declared', []))
      .toThrow('Unknown flag: "not_declared"');
  });
});

describe('updateCounter', () => {
  it('decrements counter', () => {
    const state = createGameState(testConfig);
    const val = updateCounter(state, 'candles', -1);
    expect(val).toBe(99);
    expect(state.counters.candles).toBe(99);
  });

  it('throws on unknown counter', () => {
    const state = createGameState(testConfig);
    expect(() => updateCounter(state, 'bogus', 1))
      .toThrow('Unknown counter: "bogus"');
  });
});
