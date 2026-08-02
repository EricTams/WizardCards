import { describe, it, expect } from 'vitest';
import { cardIdsOf } from '@engine/index';
import { buildTestState, playFromHand, endTurn, startTurn, TEST_SELF } from '@cards/index';
import { settleHandRefills } from '@cards/match/index';
import { CLOUD_ZAP } from '@cards/definitions/cloud';
import type { CardId } from '@shared/index';

/**
 * "When you run out of cards, draw 3" — the moment a hand hits zero mid-battle
 * (after the emptying step fully resolves), the combatant draws HAND_REFILL
 * cards; Brain in a Jar raises it to 4 via `bonusRefillDraw`.
 */
describe('run out of cards — the hand refill', () => {
  it('playing your last card draws 3 new ones', () => {
    const state = buildTestState({
      player: { energy: 1, hand: [CLOUD_ZAP.id], drawPile: ['a', 'b', 'c', 'd'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(cardIdsOf(after.player.hand)).toEqual(['a', 'b', 'c']);
    expect(after.player.drawPile).toHaveLength(1);
    expect(cardIdsOf(after.player.discardPile)).toEqual([CLOUD_ZAP.id]);
  });

  it('reshuffles the discard when the draw pile cannot cover the 3', () => {
    const state = buildTestState({
      player: { energy: 1, hand: [CLOUD_ZAP.id], drawPile: ['a'] as CardId[], discardPile: ['b'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    // a, then the reshuffled b + Zap itself — everything is back in hand.
    expect(cardIdsOf(after.player.hand).sort()).toEqual(['a', 'b', CLOUD_ZAP.id].sort());
    expect(after.player.discardPile).toHaveLength(0);
  });

  it('does nothing when there are no cards anywhere — and does not loop', () => {
    const empty = buildTestState({ player: { hand: [] } });
    const { state: after, events } = settleHandRefills(empty);
    expect(after.player.hand).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('stays out of the setup/mulligan phases', () => {
    const state = {
      ...buildTestState({ player: { hand: [], drawPile: ['a', 'b', 'c'] as CardId[] } }),
      phase: 'mulligan' as const,
    };
    expect(settleHandRefills(state).state.player.hand).toHaveLength(0);
  });

  it('Brain in a Jar: draws 4 instead of 3', () => {
    const state = buildTestState({
      player: {
        energy: 1,
        bonusRefillDraw: 1, // what the relic's IncreaseRefillDraw sets up
        hand: [CLOUD_ZAP.id],
        drawPile: ['a', 'b', 'c', 'd', 'e'] as CardId[],
      },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.hand).toHaveLength(4);
  });

  it('an end-of-turn Fog discard that empties the hand refills it', () => {
    const state = buildTestState({
      player: { clouds: ['fog'], hand: ['p'] as CardId[], drawPile: ['a', 'b', 'c'] as CardId[] },
    });
    const { state: after } = endTurn(state);
    expect(cardIdsOf(after.player.hand)).toEqual(['a', 'b', 'c']);
  });

  it('a turn never begins empty-handed while cards remain', () => {
    const state = buildTestState({
      player: { hand: [], drawPile: ['a', 'b', 'c', 'd'] as CardId[] },
    });
    const { state: after } = startTurn(state, { draw: 0 });
    expect(after.player.hand).toHaveLength(3);
  });
});
