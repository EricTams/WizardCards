import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { initialState, applyAll, type Action } from '@engine/index';
import { cardId, type CardId } from '@shared/index';

/**
 * The determinism guarantee is the linchpin of replay, undo, deterministic
 * tests, and multiplayer reconciliation: same seed + same action sequence must
 * always yield byte-identical state.
 */
describe('engine determinism', () => {
  const deck: CardId[] = Array.from({ length: 10 }, (_, i) => cardId(`c${i}`));

  it('same seed + same actions => identical state (draw forces reshuffles)', () => {
    const actions: Action[] = [
      { type: 'StartTurn' },
      { type: 'DrawCards', count: 12 }, // more than the deck, forcing a reshuffle
    ];
    const a = applyAll(initialState({ seed: 'run-42', deck }), actions).state;
    const b = applyAll(initialState({ seed: 'run-42', deck }), actions).state;
    expect(a).toEqual(b);
  });

  it('different seeds shuffle the reshuffled pile differently', () => {
    // Force the RNG-driven path: empty draw pile + full discard pile means the
    // next draw reshuffles, and the resulting order depends on the seed.
    const base = { ...initialState({ seed: 'x', deck }), drawPile: [], discardPile: deck };
    const actions: Action[] = [{ type: 'DrawCards', count: 10 }];
    const a = applyAll({ ...base, rng: initialState({ seed: 'seed-A', deck }).rng }, actions).state;
    const b = applyAll({ ...base, rng: initialState({ seed: 'seed-B', deck }).rng }, actions).state;
    expect(a.hand).not.toEqual(b.hand);
  });

  it('property: replaying any action sequence twice is identical', () => {
    const actionArb: fc.Arbitrary<Action> = fc.oneof(
      fc.constant<Action>({ type: 'StartTurn' }),
      fc.integer({ min: 1, max: 5 }).map<Action>((count) => ({ type: 'DrawCards', count })),
    );
    fc.assert(
      fc.property(fc.string(), fc.array(actionArb), (seed, actions) => {
        const first = applyAll(initialState({ seed, deck }), actions).state;
        const second = applyAll(initialState({ seed, deck }), actions).state;
        expect(first).toEqual(second);
      }),
    );
  });

  it('state round-trips through JSON losslessly (serializable invariant)', () => {
    const state = applyAll(initialState({ seed: 'x', deck }), [
      { type: 'DrawCards', count: 3 },
    ]).state;
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
