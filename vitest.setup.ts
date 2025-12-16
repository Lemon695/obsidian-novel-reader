// Vitest setup file
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Extend Vitest's expect with jest-dom matchers
// This allows us to use matchers like toBeInTheDocument(), toHaveClass(), etc.
