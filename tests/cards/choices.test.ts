import { describe, it, expect } from 'vitest';
import { cardIdsOf, type MinionState } from '@engine/index';
import {
  buildTestState, playFromHand, resolvePendingChoice, endTurn, TEST_SELF,
} from '@cards/index';
import { QUICKSAND, PINCH, DOUBLE_DRAW, BOIL, LITTLE_SPLASH, DRY_OUT } from '@cards/definitions/crab';
import { DUMPSTER_DIVER, NOTES, SCRIBBLE, DISPOSE } from '@cards/definitions/writer';
import { CLEANSE, SUN_RAY } from '@cards/definitions/cloud';
import { STATIC } from '@cards/definitions/cloud-persistents';
import { THROW, ALCHEMY, BATTERY } from '@cards/definitions/wizard';
import { entityId, type CardId } from '@shared/index';

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

describe('interactive cloud removal — "X clouds, your choice"', () => {
  it('pauses with picks by slot, and removes exactly the chosen clouds', () => {
    // Cleanse: "Heal 3. Remove 2 clouds." with three different clouds up.
    const state = buildTestState({
      player: { energy: 5, hp: 40, maxHp: 50, hand: [CLEANSE.id], clouds: ['storm', 'fog', 'snow'] },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    expect(paused.pending).toMatchObject({ kind: 'cloud', count: 2 });
    expect(paused.player.hp).toBe(43); // the heal already resolved
    const { state: after } = resolvePendingChoice(paused, [0, 2]); // storm + snow
    expect(after.pending).toBeUndefined();
    expect(after.player.clouds).toEqual(['fog']);
  });

  it('a chosen Lightning cloud still sets off Static', () => {
    const state = buildTestState({
      player: { energy: 5, persistents: [STATIC.id], hand: [SUN_RAY.id], clouds: ['lightning', 'fog'] },
      target: { hp: 30, maxHp: 30 },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    expect(paused.pending).toMatchObject({ kind: 'cloud', count: 1 });
    const { state: after } = resolvePendingChoice(paused, [0]); // the lightning one
    expect(after.player.clouds).toEqual(['fog']);
    expect(after.enemies[0]!.hp).toBe(30 - 3 - 2); // Sun Ray's 3 + Static's 2
  });

  it('auto-resolves when the count covers every cloud', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [CLEANSE.id], clouds: ['storm', 'fog'] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true });
    expect(after.pending).toBeUndefined();
    expect(after.player.clouds).toHaveLength(0);
  });

  it('an out-of-range slot is refused', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [SUN_RAY.id], clouds: ['storm', 'fog'] },
      target: { hp: 30, maxHp: 30 },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    expect(resolvePendingChoice(paused, [5]).state).toBe(paused);
  });
});

describe('interactive minion discards', () => {
  const minion = (cardId: CardId, n: number): MinionState => ({ id: entityId(`m-${n}`), cardId });

  it('pauses and discards exactly the chosen minion', () => {
    // Throw: "Deal 8 damage. Discard 1 minion." with two different minions out.
    const state = buildTestState({
      player: { energy: 5, hand: [THROW.id], minions: [minion(ALCHEMY.id, 1), minion(BATTERY.id, 2)] },
      target: { hp: 30, maxHp: 30 },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    expect(paused.pending).toMatchObject({ kind: 'minion', count: 1 });
    expect(paused.enemies[0]!.hp).toBe(22); // the damage already resolved
    const { state: after } = resolvePendingChoice(paused, [0]); // the Alchemy one
    expect(after.player.minions.map((m) => m.cardId)).toEqual([BATTERY.id]);
    expect(after.player.minionsDiscarded).toBe(1);
  });

  it('auto-resolves with a single minion out', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [THROW.id], minions: [minion(ALCHEMY.id, 1)] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true });
    expect(after.pending).toBeUndefined();
    expect(after.player.minions).toHaveLength(0);
  });
});

describe('interactive discard-pile recovery (Dry Out)', () => {
  it('pauses over the discard pile — including the just-played card — and moves the pick', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [DRY_OUT.id, 'x'] as CardId[], discardPile: ['a', 'b'] as CardId[] },
    });
    const paused = playFromHand(state, TEST_SELF, 0, undefined, { interactive: true }).state;
    // Dry Out itself reached the discard before its effects, so 3 candidates.
    expect(paused.pending).toMatchObject({ kind: 'recover', count: 1 });
    expect(paused.player.discardPile).toHaveLength(3);
    expect(paused.player.shield).toBe(4); // the shields already resolved
    const a = paused.player.discardPile.find((c) => (c.cardId as string) === 'a')!.uid;
    const { state: after } = resolvePendingChoice(paused, [a]);
    expect(cardIdsOf(after.player.drawPile)).toEqual(['a']);
    expect(after.player.discardPile).toHaveLength(2);
  });

  it('non-interactively takes the most recent, as before', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [DRY_OUT.id, 'x'] as CardId[], discardPile: ['a', 'b'] as CardId[] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.pending).toBeUndefined();
    // The most recent discard is Dry Out itself (it moved there when played).
    expect(cardIdsOf(after.player.drawPile)).toEqual([DRY_OUT.id]);
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
