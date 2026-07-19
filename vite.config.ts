/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  // Served from https://<user>.github.io/WizardCards/ on GitHub Pages.
  // Change to '/' for a custom domain or a <user>.github.io root site.
  base: '/WizardCards/',
  // Serve the hand-drawn art (cards, heroes, cloud/status sprites) as static
  // files: `assets/art/…` is exposed at `<base>art/…` in dev and copied into the
  // build. See `src/ui/game/art.ts` for how the game references it.
  publicDir: 'assets',
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@cards': fileURLToPath(new URL('./src/cards', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  test: {
    globals: true,
    // Skeleton tests are all pure (engine/cards/dsl). Switch to 'jsdom' and add
    // the jsdom dep when we start testing React components in src/ui.
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Engine + cards are the correctness-critical layers we insist on covering.
      include: ['src/engine/**', 'src/cards/**'],
    },
  },
});
