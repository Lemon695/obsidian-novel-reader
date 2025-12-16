import { defineConfig } from 'vitest/config';
// import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Note: Svelte plugin disabled for now due to version compatibility
  // Will be enabled when upgrading to Svelte 5
  plugins: [],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        'node_modules/**',
        'dist/**',
        'test/**',
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
      },
    },
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
