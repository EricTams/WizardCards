import { describe, it, expect } from 'vitest';
import { cardIdsOf } from '@engine/index';
import {
  buildTestState, playFromHand, resolvePendingChoice, endTurn, TEST_SELF,
} from '@cards/index';
import { QUICKSAND, PINCH, DOUBLE_DRAW, BOIL, LITTLE_SPLASH } from '@cards/definitions/crab';
import { DUMPSTER_DIVER, NOTES, SCRIBBLE, DISPOSE } from '@cards/definitions/writer';
import type { CardId } from '@shared/index';

const enemyHp = (s: ReturnType<typeof buildTestState>) => s.enemies[0]!.hp;
const uidOf = (s: ReturnType<typeof buildTestState>, cardId: CardId) =>
  s.player.hand.find((c) => c.cardId === cardId)!.uid;

describe('interactive discards — the player picks the cards', () => {
  it('an interactive play pauses on the discard, suspending the rest of the card', () => {
    // Quicksand: "Discard 1 card. Deal 2 damage." — the damage waits.
    const state = buildTestState({
      player: { energy: 5, hand: [QUICKSAND.id, 'a', 'b'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: paused } = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true });
    expect(paused.pending).toMatchObject({ kind: 'discard', count: 1 });
    expect(enemyHp(paused)).toBe(30); // suspended in pending.queued
    expect(paused.player.energy).toBe(4); // but the play itself already paid
    expect(paused.player.hand).toHaveLength(2); // nothing discarded yet
  });

  it('resolving discards exactly the chosen card, then resumes the card', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [QUICKSAND.id, 'a', 'b'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    const a = paused.player.hand.find((c) => (c.cardId as string) === 'a')!.uid;
    const { state: after } = resolvePendingChoice(paused, [a]);
    expect(after.pending).toBeUndefined();
    expect(cardIdsOf(after.player.hand)).toEqual(['b']); // 'a' was the pick
    expect(enemyHp(after)).toBe(28); // the suspended damage resumed
    expect(after.player.discardedThisTurn).toBe(1);
  });

  it('a chosen Molt card still plays itself for free', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [QUICKSAND.id, PINCH.id, 'a'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    const { state: after } = resolvePendingChoice(paused, [uidOf(paused, PINCH.id)]);
    expect(enemyHp(after)).toBe(24); // Pinch's Molt 4 + Quicksand's resumed 2
  });

  it('Double Draw pauses AFTER drawing — freshly drawn cards are pickable', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [DOUBLE_DRAW.id, 'a'] as CardId[], drawPile: ['b', 'c'] as CardId[] },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    expect(paused.pending).toMatchObject({ kind: 'discard', count: 2 });
    expect(cardIdsOf(paused.player.hand).sort()).toEqual(['a', 'b', 'c']); // drew first
    const b = paused.player.hand.find((c) => (c.cardId as string) === 'b')!.uid;
    const c = paused.player.hand.find((c2) => (c2.cardId as string) === 'c')!.uid;
    const { state: after } = resolvePendingChoice(paused, [b, c]);
    expect(cardIdsOf(after.player.hand)).toEqual(['a']);
  });

  it('auto-resolves when there is no real choice (count covers the whole hand)', () => {
    // Boil discards 3 with exactly 3 others in hand — nothing to choose.
    const state = buildTestState({
      player: { energy: 5, hand: [BOIL.id, 'a', 'b', 'c'] as CardId[] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true });
    expect(after.pending).toBeUndefined();
    expect(after.player.discardedThisTurn).toBe(3);
  });

  it('non-interactive play never pauses (the AI path)', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [QUICKSAND.id, 'a', 'b'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.pending).toBeUndefined();
    expect(enemyHp(after)).toBe(28); // rightmost 'b' went, damage resolved
    expect(cardIdsOf(after.player.hand)).toEqual(['a']);
  });

  it('refuses a wrong-sized or illegal pick, leaving the pause in place', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [QUICKSAND.id, 'a', 'b'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    expect(resolvePendingChoice(paused, []).state).toBe(paused); // too few
    expect(resolvePendingChoice(paused, [9999]).state).toBe(paused); // not in hand
  });

  it('the end-of-turn Fog discard pauses, then EndTurn resumes from the queue', () => {
    const state = buildTestState({
      player: { clouds: ['fog'], hand: ['a', 'b'] as CardId[] },
    });
    const paused = endTurn(state, { interactive: true }).state;
    expect(paused.pending).toMatchObject({ kind: 'discard', count: 1 });
    expect(paused.phase).toBe('playerTurn'); // EndTurn still queued
    const a = paused.player.hand.find((c) => (c.cardId as string) === 'a')!.uid;
    const { state: after } = resolvePendingChoice(paused, [a]);
    expect(cardIdsOf(after.player.hand)).toEqual(['b']);
    expect(after.phase).toBe('enemyTurn'); // the queued EndTurn ran
  });
});

describe('interactive burns — the player picks the Unplayable cards', () => {
  it('pauses when there are more Unplayable cards than the burn needs', () => {
    // Dumpster Diver burns 1; Notes and Scribble are both eligible.
    const state = buildTestState({
      player: { energy: 5, hand: [DUMPSTER_DIVER.id, NOTES.id, SCRIBBLE.id, 'a'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    expect(paused.pending).toMatchObject({ kind: 'burn', count: 1 });
    const { state: after } = resolvePendingChoice(paused, [uidOf(paused, SCRIBBLE.id)]);
    expect(after.player.energy).toBe(4 + 1); // the chosen Scribble's burned effect
    expect(cardIdsOf(after.player.hand).sort()).toEqual([NOTES.id, 'a'].sort()); // Notes survived
    expect(enemyHp(after)).toBe(28); // Dumpster Diver's own damage resumed
  });

  it('auto-resolves when the burn takes every Unplayable card anyway', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [DUMPSTER_DIVER.id, DISPOSE.id, 'a'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true });
    expect(after.pending).toBeUndefined();
    expect(enemyHp(after)).toBe(24); // Dispose 4 + Dumpster Diver 2
  });

  it('a pick pointing at a playable card is refused', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [DUMPSTER_DIVER.id, NOTES.id, SCRIBBLE.id, LITTLE_SPLASH.id] as CardId[] },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    const splash = paused.player.hand.find((c) => c.cardId === LITTLE_SPLASH.id)!.uid;
    expect(resolvePendingChoice(paused, [splash]).state).toBe(paused);
  });
});

describe('the pause is plain data', () => {
  it('a paused state survives a JSON round-trip', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [QUICKSAND.id, 'a', 'b'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    const revived = JSON.parse(JSON.stringify(paused)) as typeof paused;
    expect(revived).toEqual(paused);
    // …and the revived state still resolves.
    const a = revived.player.hand.find((c) => (c.cardId as string) === 'a')!.uid;
    expect(resolvePendingChoice(revived, [a]).state.pending).toBeUndefined();
  });
});
