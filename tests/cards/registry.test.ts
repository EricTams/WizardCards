import { describe, it, expect } from 'vitest';
import { ALL_CARDS, compile } from '@cards/index';
import { initialState, apply, type GameState } from '@engine/index';
import { entityId } from '@shared/index';

/**
 * The "every card" guarantee: this suite is data-driven over the registry, so a
 * newly added card is automatically tested. As cards gain edge cases, add
 * per-card expectation fixtures here rather than one-off test files.
 */
const SELF = entityId('player');
const TARGET = entityId('enemy');

function sandbox(): GameState {
  return {
    ...initialState({ seed: 'test', deck: [] }),
    enemies: [{ id: TARGET, name: 'Dummy', hp: 50, maxHp: 50, block: 0 }],
  };
}

describe('every card in the registry', () => {
  it.each(ALL_CARDS.map((c) => [c.name, c] as const))(
    '%s compiles and produces applicable actions',
    (_name, card) => {
      const compiled = compile(card.text);
      expect(compiled.ok, `"${card.text}" failed to compile`).toBe(true);
      if (!compiled.ok) return;

      // Each producer yields a real Action, and applying them never throws.
      let state = sandbox();
      for (const produce of compiled.value) {
        const action = produce({ self: SELF, target: TARGET });
        expect(action.type).toBeTypeOf('string');
        state = apply(state, action).state;
      }
      // Serializable invariant holds after playing the card.
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    },
  );

  it('has unique card ids', () => {
    const ids = ALL_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
