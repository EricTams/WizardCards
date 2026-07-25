import { describe, it, expect } from 'vitest';
import { buildTestState, playFromHand, confirmMulligan, startTurn, TEST_SELF, TEST_TARGET } from '@cards/index';
import { applyWithTriggers } from '@cards/match/index';
import { hasClaw } from '@cards/match/claw';
import { PINCH, LITTLE_SPLASH, HERMIT, LOCATOR, BOIL, QUICKSAND } from '@cards/definitions/crab';
import type { CardId } from '@shared/index';

const enemyHp = (s: ReturnType<typeof buildTestState>) => s.enemies[0]!.hp;

describe('Claw — reading the keyword', () => {
  it('is carried by cards whose text declares it, and not by others', () => {
    expect(hasClaw(PINCH)).toBe(true);
    expect(hasClaw(HERMIT)).toBe(true);
    expect(hasClaw(LITTLE_SPLASH)).toBe(false);
  });

  it('does not turn the keyword into an on-play effect', () => {
    // "Claw. Deal 4 damage." must still deal exactly 4 — the keyword is a
    // property of the card, not an extra statement.
    const state = buildTestState({ player: { energy: 5, hand: [PINCH.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(enemyHp(after)).toBe(26);
  });
});

describe('Claw — plays for free when discarded', () => {
  it('fires on a genuine discard', () => {
    const state = buildTestState({
      player: { energy: 0, hand: [PINCH.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 });

    expect(after.enemies[0]!.hp).toBe(26); // Pinch played itself from the discard
    expect(after.player.energy).toBe(0); // …and cost nothing
    expect(after.player.hand).toHaveLength(0);
    expect(after.player.discardPile).toEqual([PINCH.id]);
  });

  it('does NOT fire for a card without Claw', () => {
    const state = buildTestState({ player: { hand: [LITTLE_SPLASH.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 });
    expect(after.enemies[0]!.hp).toBe(30);
  });

  it('does NOT fire when the card is played — a Claw card is not played twice', () => {
    // playFromHand moves the card to the discard pile, which emits the same
    // CardsDiscarded event. Only `reason: 'discard'` may trigger Claw.
    const state = buildTestState({ player: { energy: 5, hand: [PINCH.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(enemyHp(after)).toBe(26); // 4, not 8
  });

  it('does NOT fire during the opening mulligan — setup is its own kind of discard', () => {
    const state = {
      ...buildTestState({ player: { hand: [PINCH.id, LITTLE_SPLASH.id] }, target: { hp: 30, maxHp: 30 } }),
      phase: 'mulligan' as const,
    };
    const { state: after } = confirmMulligan(state, [0]);
    expect(after.enemies[0]!.hp).toBe(30);
    expect(after.player.discardPile).toContain(PINCH.id); // it was still discarded
  });

  it('fires however the discard was caused, and still fights for its owner', () => {
    // Nothing can force an opponent to discard today, but the machinery is
    // owner-relative rather than causer-relative, so it holds when one can.
    const state = buildTestState({ player: { energy: 0, hand: [PINCH.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 });
    expect(after.enemies[0]!.hp).toBe(26); // hits our opponent…
    expect(after.player.hp).toBe(state.player.hp); // …not us
  });

  it("an enemy Crab's Claw aims back at the player — reachable in Attract Mode", () => {
    const base = buildTestState({ player: { hp: 30, maxHp: 30 }, target: { hp: 30, maxHp: 30 } });
    const state = { ...base, enemies: [{ ...base.enemies[0]!, hand: [PINCH.id] }] };
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_TARGET, count: 1 });
    expect(after.player.hp).toBe(26); // the enemy's Claw hit us
    expect(after.enemies[0]!.hp).toBe(30); // it did not hit itself
  });

  it('chains — a discarded Claw card that itself discards keeps the cascade going', () => {
    // Hermit: "Claw. Heal 2. Discard 1 card." Discarding it heals and discards
    // Pinch beneath it, whose own Claw then fires.
    const state = buildTestState({
      player: { hp: 10, maxHp: 30, energy: 0, hand: [PINCH.id, HERMIT.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 });

    expect(after.player.hp).toBe(12); // Hermit healed 2
    expect(after.enemies[0]!.hp).toBe(26); // then Pinch's Claw dealt 4
    expect(after.player.hand).toHaveLength(0);
  });
});

describe('cards discarded this turn', () => {
  it('counts discards and scales Locator off them', () => {
    // Boil discards 3, then Locator (played after) reads that count.
    const state = buildTestState({
      player: { energy: 5, hand: ['x', 'y', 'z', BOIL.id] as CardId[], drawPile: [LOCATOR.id] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const afterBoil = playFromHand(state, TEST_SELF, 3).state;
    expect(afterBoil.player.discardedThisTurn).toBe(3);

    const withLocator = { ...afterBoil, player: { ...afterBoil.player, hand: [LOCATOR.id] as CardId[] } };
    const { state: after } = playFromHand(withLocator, TEST_SELF, 0);
    expect(after.enemies[0]!.hp).toBe(27); // 1 damage x 3 cards discarded
  });

  it('a played card moving to the discard pile does not count as a discard', () => {
    const state = buildTestState({ player: { energy: 5, hand: [LITTLE_SPLASH.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.discardedThisTurn).toBe(0);
  });

  it('resets when the turn starts', () => {
    const state = buildTestState({
      player: { energy: 5, hand: ['x', QUICKSAND.id] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const afterPlay = playFromHand(state, TEST_SELF, 1).state;
    expect(afterPlay.player.discardedThisTurn).toBe(1);

    const { state: next } = startTurn(afterPlay, { draw: 0 });
    expect(next.player.discardedThisTurn).toBe(0);
  });
});
