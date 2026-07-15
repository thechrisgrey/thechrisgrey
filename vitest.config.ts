/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    css: false,
    reporters: ['default', ['junit', { outputFile: 'test-results/junit.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**', 'src/main.tsx', 'src/vite-env.d.ts', 'src/data/**'],
      thresholds: {
        lines: 66,
        statements: 64,
        branches: 62,
        functions: 60,
      },
    },
  },
});
