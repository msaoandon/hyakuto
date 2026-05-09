import { describe, it, expect } from 'vitest';
import { calculateTypingMs, calculateDelayMs } from '../src/queue/timing.js';

describe('calculateTypingMs', () => {
  it('scales with text length', () => {
    const short = calculateTypingMs('hi', 1.0, 1.0);
    const long = calculateTypingMs('this is a much longer message with more characters', 1.0, 1.0);
    expect(long).toBeGreaterThan(short);
  });

  it('clamps to MAX_TYPING_MS', () => {
    const result = calculateTypingMs('a'.repeat(500), 1.0, 1.0);
    expect(result).toBeLessThanOrEqual(4000);
  });

  it('applies character rate multiplier', () => {
    const normal = calculateTypingMs('hello world', 1.0, 1.0);
    const slow = calculateTypingMs('hello world', 1.4, 1.0);
    const fast = calculateTypingMs('hello world', 0.6, 1.0);
    expect(slow).toBeGreaterThan(normal);
    expect(fast).toBeLessThan(normal);
  });

  it('applies pace multiplier', () => {
    const normal = calculateTypingMs('hello world', 1.0, 1.0);
    const slow = calculateTypingMs('hello world', 1.0, 1.5);
    const fast = calculateTypingMs('hello world', 1.0, 0.5);
    expect(slow).toBeGreaterThan(normal);
    expect(fast).toBeLessThan(normal);
  });

  it('returns 0 at skip pace', () => {
    const result = calculateTypingMs('hello world', 1.0, 0);
    expect(result).toBe(0);
  });
});

describe('calculateDelayMs', () => {
  it('first in group has longer delay', () => {
    const first = calculateDelayMs(true, 1.0);
    const continuation = calculateDelayMs(false, 1.0);
    expect(first).toBeGreaterThan(continuation);
  });

  it('returns 0 at skip pace', () => {
    expect(calculateDelayMs(true, 0)).toBe(0);
    expect(calculateDelayMs(false, 0)).toBe(0);
  });

  it('scales with pace', () => {
    const normal = calculateDelayMs(true, 1.0);
    const slow = calculateDelayMs(true, 1.5);
    expect(slow).toBeGreaterThan(normal);
  });
});
