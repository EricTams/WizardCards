import { describe, it, expect } from 'vitest';
import { cardIdsOf } from '@engine/index';
import {
  buildTestState, playFromHand, confirmMulligan, startTurn, endTurn, pileOf, TEST_SELF, TEST_TARGET,
} from '@cards/index';
import { applyWithTriggers } from '@cards/match/index';
import { hasMolt } from '@cards/match/molt';
import {
  PINCH, LITTLE_SPLASH, HERMIT, LOCATOR, BOIL, QUICKSAND, REFRESH,
  SAND_KICK, TENTACLES, CRAB_WALK, DRY_OUT, DUNGEON_NESS, SKITTER, SNIP,
} from '@cards/definitions/crab';
import { EXOSKELETON, DECAPOD, EYESTALKS, PRAWN, DECORATOR } from '@cards/definitions/crab-persistents';
import type { CardId } from '@shared/index';

const enemyHp = (s: ReturnType<typeof buildTestState>) => s.enemies[0]!.hp;

describe('Molt — reading the keyword', () => {
  it('is carried by cards whose text declares it, and not by others', () => {
    expect(hasMolt(PINCH)).toBe(true);
    expect(hasMolt(HERMIT)).toBe(true);
    expect(hasMolt(LITTLE_SPLASH)).toBe(false);
  });

  it('does not turn the keyword into an on-play effect', () => {
    // "Molt. Deal 4 damage." must still deal exactly 4 — the keyword is a
    // property of the card, not an extra statement.
    const state = buildTestState({ player: { energy: 5, hand: [PINCH.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(enemyHp(after)).toBe(26);
  });
});

describe('Molt — plays for free when discarded', () => {
  it('fires on a genuine discard', () => {
    const state = buildTestState({
      player: { energy: 0, hand: [PINCH.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 });

    expect(after.enemies[0]!.hp).toBe(26); // Pinch played itself from the discard
    expect(after.player.energy).toBe(0); // …and cost nothing
    expect(after.player.hand).toHaveLength(0);
    expect(cardIdsOf(after.player.discardPile)).toEqual([PINCH.id]);
  });

  it('does NOT fire for a card without Molt', () => {
    const state = buildTestState({ player: { hand: [LITTLE_SPLASH.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 });
    expect(after.enemies[0]!.hp).toBe(30);
  });

  it('does NOT fire when the card is played — a Molt card is not played twice', () => {
    // playFromHand moves the card to the discard pile, which emits the same
    // CardsDiscarded event. Only `reason: 'discard'` may trigger Molt.
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
    expect(cardIdsOf(after.player.discardPile)).toContain(PINCH.id); // it was still discarded
  });

  it('fires however the discard was caused, and still fights for its owner', () => {
    // Nothing can force an opponent to discard today, but the machinery is
    // owner-relative rather than causer-relative, so it holds when one can.
    const state = buildTestState({ player: { energy: 0, hand: [PINCH.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 });
    expect(after.enemies[0]!.hp).toBe(26); // hits our opponent…
    expect(after.player.hp).toBe(state.player.hp); // …not us
  });

  it("an enemy Crab's Molt aims back at the player — reachable in Attract Mode", () => {
    const base = buildTestState({ player: { hp: 30, maxHp: 30 }, target: { hp: 30, maxHp: 30 } });
    const state = { ...base, enemies: [{ ...base.enemies[0]!, hand: pileOf(PINCH.id) }] };
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_TARGET, count: 1 });
    expect(after.player.hp).toBe(26); // the enemy's Molt hit us
    expect(after.enemies[0]!.hp).toBe(30); // it did not hit itself
  });

  it('chains — a discarded Molt card that itself discards keeps the cascade going', () => {
    // Hermit: "Molt. Heal 2. Discard 1 card." Discarding it heals and discards
    // Pinch beneath it, whose own Molt then fires.
    const state = buildTestState({
      player: { hp: 10, maxHp: 30, energy: 0, hand: [PINCH.id, HERMIT.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 });

    expect(after.player.hp).toBe(12); // Hermit healed 2
    expect(after.enemies[0]!.hp).toBe(26); // then Pinch's Molt dealt 4
    expect(after.player.hand).toHaveLength(0);
  });
});

describe('discard your hand', () => {
  it('Refresh dumps the hand — firing any Molt on the way out — then redraws 3', () => {
    const state = buildTestState({
      player: {
        energy: 5,
        hand: [PINCH.id, 'x' as CardId, REFRESH.id],
        drawPile: ['a', 'b', 'c', 'd'] as CardId[],
      },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 2);

    expect(after.enemies[0]!.hp).toBe(26); // the dumped Pinch played itself
    expect(after.player.hand).toHaveLength(3); // …then drew a fresh 3
    expect(after.player.discardedThisTurn).toBe(2); // both dumped cards counted
  });

  it('Exoskeleton cashes 5+ block for a new hand at end of turn', () => {
    const state = buildTestState({
      player: {
        block: 5,
        persistents: [EXOSKELETON.id],
        hand: ['p', 'q'] as CardId[],
        drawPile: ['a', 'b', 'c', 'd', 'e'] as CardId[],
      },
    });
    expect(endTurn(state).state.player.hand).toHaveLength(5);
  });

  it('Exoskeleton stays quiet below 5 block', () => {
    const state = buildTestState({
      player: {
        block: 2,
        persistents: [EXOSKELETON.id],
        hand: ['p', 'q'] as CardId[],
        drawPile: ['a', 'b', 'c', 'd', 'e'] as CardId[],
      },
    });
    expect(endTurn(state).state.player.hand).toHaveLength(2);
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

    const withLocator = { ...afterBoil, player: { ...afterBoil.player, hand: pileOf(LOCATOR.id) } };
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

describe('moving cards between piles', () => {
  it('Sand Kick comes back to hand after dealing its damage', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [SAND_KICK.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.enemies[0]!.hp).toBe(27);
    expect(cardIdsOf(after.player.hand)).toEqual([SAND_KICK.id]); // back in hand…
    expect(after.player.discardPile).toHaveLength(0); // …not left in the discard
  });

  it('Sand Kick no longer carries Molt — discarding it is just a discard', () => {
    const state = buildTestState({
      player: { energy: 0, hand: [SAND_KICK.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 });
    expect(after.enemies[0]!.hp).toBe(30);
    expect(after.player.hand).toHaveLength(0);
    expect(cardIdsOf(after.player.discardPile)).toEqual([SAND_KICK.id]);
  });

  it('Tentacles goes back into the draw pile instead of the discard', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [TENTACLES.id, 'z' as CardId], drawPile: ['a', 'b'] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.enemies[0]!.hp).toBe(28);
    expect(cardIdsOf(after.player.drawPile)).toContain(TENTACLES.id);
    expect(after.player.drawPile).toHaveLength(3);
    expect(after.player.discardPile).toHaveLength(0);
  });

  it('Crab Walk mills 3 off the draw pile — which is not a hand discard', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [CRAB_WALK.id, 'z' as CardId], drawPile: ['a', 'b', 'c', 'd', 'e'] as CardId[] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.drawPile).toHaveLength(2);
    expect(after.player.discardPile).toHaveLength(4); // 3 milled + Crab Walk itself
    // Milling never touched a hand, so it must not count as discarding.
    expect(after.player.discardedThisTurn).toBe(0);
  });

  it('Dry Out recycles a card out of the discard pile', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [DRY_OUT.id, 'z' as CardId], discardPile: ['a', 'b'] as CardId[], drawPile: [] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.shield).toBe(4);
    expect(after.player.drawPile).toHaveLength(1);
  });
});

describe('the discard-counting persistents', () => {
  it('Decapod fires only once the turn total reaches 10', () => {
    const hand = Array.from({ length: 12 }, (_, i) => `c${i}` as CardId);
    const state = buildTestState({
      player: { persistents: [DECAPOD.id], hand },
      target: { hp: 40, maxHp: 40 },
    });
    const few = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 3 }).state;
    expect(few.enemies[0]!.hp).toBe(40); // 3 discards: nothing

    const many = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 10 }).state;
    expect(many.enemies[0]!.hp).toBeLessThan(40); // 10 discards: it goes off
  });

  it('Eyestalks pays out only when the hand is emptied', () => {
    const partial = buildTestState({
      player: { energy: 0, persistents: [EYESTALKS.id], hand: ['a', 'b', 'c'] as CardId[] },
    });
    expect(applyWithTriggers(partial, { type: 'DiscardCards', owner: TEST_SELF, count: 1 }).state.player.energy).toBe(0);

    const emptied = buildTestState({
      player: { energy: 0, persistents: [EYESTALKS.id], hand: ['a', 'b'] as CardId[] },
    });
    expect(applyWithTriggers(emptied, { type: 'DiscardHand', owner: TEST_SELF }).state.player.energy).toBeGreaterThan(0);
  });

  it('Prawn fires per discarded Molt card, ignoring the rest', () => {
    const withMolt = buildTestState({
      player: { persistents: [PRAWN.id], hand: [LITTLE_SPLASH.id, PINCH.id] },
      target: { hp: 40, maxHp: 40 },
    });
    const a = applyWithTriggers(withMolt, { type: 'DiscardCards', owner: TEST_SELF, count: 1 }).state;
    expect(a.enemies[0]!.hp).toBe(40 - 3 - 4); // Prawn's 3, plus Pinch's own Molt

    const noMolt = buildTestState({
      player: { persistents: [PRAWN.id], hand: [LITTLE_SPLASH.id] },
      target: { hp: 40, maxHp: 40 },
    });
    expect(applyWithTriggers(noMolt, { type: 'DiscardCards', owner: TEST_SELF, count: 1 }).state.enemies[0]!.hp).toBe(40);
  });
});

describe('granted Molt — the per-copy mark', () => {
  it('Dungeon-ness marks a card that had no Molt, and it then fires on discard', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [LITTLE_SPLASH.id, DUNGEON_NESS.id] },
      target: { hp: 40, maxHp: 40 },
    });
    const marked = playFromHand(state, TEST_SELF, 1).state;
    expect(marked.player.shield).toBe(3);
    expect(marked.player.hand[0]!.molt).toBe(true); // Little Splash now carries it

    // Discarding it plays it for free, which a plain Little Splash never does.
    const after = applyWithTriggers(marked, { type: 'DiscardCards', owner: TEST_SELF, count: 1 }).state;
    expect(after.enemies[0]!.hp).toBe(34); // its 6 damage
  });

  it('marks the copy, not the card — an identical copy stays unmarked', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [LITTLE_SPLASH.id, LITTLE_SPLASH.id, DUNGEON_NESS.id] },
      target: { hp: 40, maxHp: 40 },
    });
    const marked = playFromHand(state, TEST_SELF, 2).state;
    expect(marked.player.hand.map((c) => c.molt === true)).toEqual([true, false]);
  });

  it('Skitter marks two, and its own printed Molt still works', () => {
    const state = buildTestState({
      player: { energy: 0, hand: [LITTLE_SPLASH.id, SNIP.id, SKITTER.id] },
      target: { hp: 40, maxHp: 40 },
    });
    // Discard Skitter itself: printed Molt fires it, which marks the two below.
    const after = applyWithTriggers(state, { type: 'DiscardCards', owner: TEST_SELF, count: 1 }).state;
    expect(after.player.hand.map((c) => c.molt === true)).toEqual([true, true]);
  });

  it('the mark survives moving between piles', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [SAND_KICK.id, DUNGEON_NESS.id] },
      target: { hp: 40, maxHp: 40 },
    });
    const marked = playFromHand(state, TEST_SELF, 1).state;
    expect(marked.player.hand[0]!.molt).toBe(true);
    // Sand Kick returns itself to hand; the granted mark must come back with it.
    const played = playFromHand(marked, TEST_SELF, 0).state;
    expect(played.player.hand[0]!.molt).toBe(true);
  });

  it('Decorator marks the top of the draw pile whenever the deck is shuffled', () => {
    const state = buildTestState({
      player: { persistents: [DECORATOR.id], drawPile: ['a', 'b', 'c', 'd'] as CardId[] },
    });
    const after = applyWithTriggers(state, { type: 'ShuffleDrawPile', owner: TEST_SELF }).state;
    expect(after.player.drawPile[0]!.molt).toBe(true);
    expect(after.player.drawPile.filter((c) => c.molt).length).toBe(1); // just the top
  });

  it('Crab Walk mills away the card Decorator just marked — shuffle, then cut', () => {
    // Not a bug: Crab Walk shuffles (Decorator marks the new top) and then
    // discards the top 3, which takes the freshly-marked card with them.
    const state = buildTestState({
      player: {
        energy: 5,
        persistents: [DECORATOR.id],
        hand: [CRAB_WALK.id, 'z' as CardId],
        drawPile: ['a', 'b', 'c', 'd'] as CardId[],
      },
    });
    const after = playFromHand(state, TEST_SELF, 0).state;
    expect(after.player.drawPile[0]!.molt).toBeUndefined();
    expect(after.player.discardPile.some((c) => c.molt === true)).toBe(true);
  });
});
