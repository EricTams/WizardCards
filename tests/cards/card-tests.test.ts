import { describe, it, expect } from 'vitest';
import { ALL_CARDS, CARD_TESTS, runCardTest } from '@cards/index';

/**
 * Data-driven behavioural suite: every declarative CardTest is run through the
 * real engine and its expectations checked. Authors add cases in `card-tests.ts`
 * (or, later, the Card Lab), and they are covered here automatically.
 */
const byId = new Map(ALL_CARDS.map((c) => [c.id as string, c]));

describe('declarative card tests', () => {
  it.each(CARD_TESTS.map((t) => [t.name, t] as const))('%s', (_name, test) => {
    const card = byId.get(test.cardId as string);
    expect(card, `no registered card with id "${test.cardId}"`).toBeDefined();
    if (!card) return;

    const result = runCardTest(card, test);
    // Surface a readable diff if the card misbehaves.
    const detail = result.error
      ? result.error
      : result.failures.map((f) => `${f.field}: expected ${f.expected}, got ${f.actual}`).join('; ');
    expect(result.ok, detail).toBe(true);
  });

  it('every test targets a real card', () => {
    for (const test of CARD_TESTS) {
      expect(byId.has(test.cardId as string), `unknown card ${test.cardId}`).toBe(true);
    }
  });
});
