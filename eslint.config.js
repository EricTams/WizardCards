import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * The dependency rule that makes WizardCards' state/display separation REAL:
 *
 *     ui  ->  cards  ->  engine  ->  shared
 *
 * Imports may only point rightward (toward more foundational layers). Any import
 * pointing left is an error. We enforce it with no-restricted-imports matched on
 * our path aliases (@engine/@cards/@shared/@ui) — reliable and dependency-free,
 * since every cross-layer import goes through an alias by convention.
 */
const forbid = (groups, message) => ({
  '@typescript-eslint/no-restricted-imports': ['error', { patterns: [{ group: groups, message }] }],
});

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // shared: the foundation — may import nothing else in the project.
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: forbid(
      ['@engine', '@engine/*', '@cards', '@cards/*', '@ui', '@ui/*'],
      'shared is the foundation layer and must not import from other layers.',
    ),
  },

  // engine: pure core — may import shared only.
  {
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: forbid(
      ['@cards', '@cards/*', '@ui', '@ui/*'],
      'engine must stay pure: it may import @shared only, never @cards or @ui.',
    ),
  },

  // cards: may import engine + shared, never the UI.
  {
    files: ['src/cards/**/*.{ts,tsx}'],
    rules: forbid(
      ['@ui', '@ui/*'],
      'cards must not import from @ui (the display layer).',
    ),
  },

  // The UI layer runs in the browser and may import any lower layer.
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Tests may reach into any layer.
  {
    files: ['tests/**/*.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Config files run in Node.
  {
    files: ['*.config.{ts,js}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
