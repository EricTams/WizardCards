import { describe, it, expect } from 'vitest';
import { buildTestState, playFromHand, TEST_SELF } from '@cards/index';
import { uniqueMarkings } from '@cards/match/marks';
import {
  BEHEAD, PROTECT, MATCHES, CHISEL, PLATE, HELMET, SNAP, RANGE, HEALING_POTION, CATAPULT,
} from '@cards/definitions/knight';
import { ENGRAVE, ETCHING, WOODWORKING } from '@cards/definitions/knight-persistents';
import type { CardId } from '@shared/index';

const enemyHp = (s: ReturnType<typeof buildTestState>) => s.enemies[0]!.hp;

describe('Marking cards in hand', () => {
  it('marks the leftmost cards, and marks nothing it was not asked to', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [BEHEAD.id, HELMET.id, HELMET.id, HELMET.id] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.hand.map((c) => c.marks?.sharp)).toEqual([2, 2, undefined]);
  });

  it('"all cards in your hand" reaches every one of them', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [PROTECT.id, HELMET.id, HELMET.id, HELMET.id] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.hand.every((c) => c.marks?.sharp === 1)).toBe(true);
  });

  it('marking an already-marked card raises the value', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [BEHEAD.id, BEHEAD.id, HELMET.id] },
    });
    const once = playFromHand(state, TEST_SELF, 0).state;
    const twice = playFromHand(once, TEST_SELF, 0).state;
    expect(twice.player.hand[0]!.marks?.sharp).toBe(4);
  });

  it('a card can carry more than one Marking', () => {
    const state = buildTestState({ player: { energy: 5, hand: [SNAP.id, HELMET.id] } });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.hand[0]!.marks).toEqual({ sturdy: 2, flaming: 1 });
    expect(uniqueMarkings(after.player.hand[0])).toBe(2);
  });

  it('a random mark lands on exactly one card, deterministically', () => {
    const setup = {
      player: { energy: 5, hand: [MATCHES.id, HELMET.id, HELMET.id, HELMET.id] },
      target: { hp: 30, maxHp: 30 },
      seed: 'knight-random',
    };
    const a = playFromHand(buildTestState(setup), TEST_SELF, 0).state;
    const b = playFromHand(buildTestState(setup), TEST_SELF, 0).state;
    expect(a.player.hand.filter((c) => c.marks?.flaming === 1)).toHaveLength(1);
    expect(a.player.hand.map((c) => c.marks?.flaming)).toEqual(b.player.hand.map((c) => c.marks?.flaming));
  });

  it('Chisel picks one of the four Markings at random', () => {
    const state = buildTestState({ player: { energy: 5, hand: [CHISEL.id, HELMET.id] }, seed: 'chisel' });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    const marks = after.player.hand[0]!.marks!;
    expect(Object.values(marks)).toEqual([3]);
  });

  it('Plate wipes the slate before writing on it', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [BEHEAD.id, PLATE.id, HELMET.id, HELMET.id] },
    });
    const marked = playFromHand(state, TEST_SELF, 0).state; // Behead: sharp 2 ×2
    expect(marked.player.hand[0]!.marks?.sharp).toBe(2);
    const plated = playFromHand(marked, TEST_SELF, 0).state;
    expect(plated.player.hand[0]!.marks).toEqual({ flaming: 3 });
    expect(plated.player.hand[1]!.marks).toBeUndefined();
  });
});

describe('Playing a marked card fires its Markings, once', () => {
  it('Sharp hits, Sturdy draws, Flaming pays, Safe heals', () => {
    const state = buildTestState({
      player: {
        energy: 5,
        hp: 30,
        maxHp: 50,
        hand: [RANGE.id, HELMET.id],
        drawPile: ['a', 'b', 'c'] as CardId[],
      },
      target: { hp: 30, maxHp: 30 },
    });
    // Range marks Helmet with Sturdy 3, so playing Helmet should draw 3.
    const marked = playFromHand(state, TEST_SELF, 0).state;
    const played = playFromHand(marked, TEST_SELF, 0).state;
    expect(played.player.hand.length).toBe(3); // the three drawn cards
    expect(played.player.shield).toBe(4 + 6); // Range's 4, then Helmet's 6

    const potion = buildTestState({
      player: { energy: 5, hp: 30, maxHp: 50, hand: [HEALING_POTION.id, HELMET.id] },
    });
    const safe = playFromHand(potion, TEST_SELF, 0).state; // heal 2, mark safe 3
    expect(safe.player.hp).toBe(32);
    expect(playFromHand(safe, TEST_SELF, 0).state.player.hp).toBe(35); // + the Safe 3
  });

  it('the Marking is spent when the card is played', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [BEHEAD.id, CATAPULT.id, HELMET.id], drawPile: ['a', 'b'] as CardId[] },
      target: { hp: 40, maxHp: 40 },
    });
    const marked = playFromHand(state, TEST_SELF, 0).state; // Catapult + Helmet: sharp 2
    const first = playFromHand(marked, TEST_SELF, 0).state; // Catapult: 4 + its Sharp 2
    expect(enemyHp(first)).toBe(34);
    // Catapult's copy went to the discard with its marking; nothing lingers.
    expect(first.player.discardPile.some((c) => c.cardId === CATAPULT.id && c.marks?.sharp === 2)).toBe(true);
  });

  it('an unmarked card plays exactly as printed', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [CATAPULT.id], drawPile: ['a'] as CardId[] },
      target: { hp: 40, maxHp: 40 },
    });
    expect(enemyHp(playFromHand(state, TEST_SELF, 0).state)).toBe(36);
  });
});

describe('the Knight persistents', () => {
  it('Engrave, Etching and Woodworking each pay out on their own Marking', () => {
    const state = buildTestState({
      player: {
        energy: 5,
        persistents: [ENGRAVE.id, ETCHING.id, WOODWORKING.id],
        hand: [SNAP.id, HELMET.id],
        drawPile: ['a', 'b', 'c'] as CardId[],
      },
      target: { hp: 30, maxHp: 30 },
    });
    // Snap marks Helmet with Sturdy 2 and Flaming 1.
    const marked = playFromHand(state, TEST_SELF, 0).state;
    const played = playFromHand(marked, TEST_SELF, 0).state;
    expect(played.player.hand.length).toBe(3); // Sturdy 2 + Etching's extra 1
    expect(played.player.shield).toBe(6); // Helmet's own 6; Sharp never fired
    expect(enemyHp(played)).toBe(30); // no Safe marking, so Woodworking stayed quiet
  });

  it('Engrave adds a shield when a Sharp-marked card is played', () => {
    const state = buildTestState({
      player: { energy: 5, persistents: [ENGRAVE.id], hand: [BEHEAD.id, CATAPULT.id, HELMET.id], drawPile: ['a'] as CardId[] },
      target: { hp: 40, maxHp: 40 },
    });
    const marked = playFromHand(state, TEST_SELF, 0).state;
    const played = playFromHand(marked, TEST_SELF, 0).state; // Catapult, Sharp 2
    expect(enemyHp(played)).toBe(34);
    expect(played.player.shield).toBe(1);
  });
});
