// Example test to verify Vitest setup
import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support TypeScript', () => {
    const greeting = (name: string): string => `Hello, ${name}!`;
    expect(greeting('World')).toBe('Hello, World!');
  });

  it('should support async tests', async () => {
    const promise = Promise.resolve(42);
    await expect(promise).resolves.toBe(42);
  });
});
