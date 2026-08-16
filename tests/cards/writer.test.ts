import { describe, it, expect } from 'vitest';
import { cardIdsOf } from '@engine/index';
import {
  buildTestState,
  playFromHand,
  canPlayAt,
  energyCostAt,
  startTurn,
  endTurn,
  TEST_SELF,
  newBattle,
  confirmMulligan,
  endPlayerTurn,
} from '@cards/index';
import { applyWithTriggers } from '@cards/match/index';
import { printedKeywords, burnCostOf } from '@cards/match/keywords';
import {
  PEN_STAB, DUMPSTER_DIVER, REFRAME, TROPHY, QUILL, SEARCH,
  TYPE, EVADE, PLAYWRIGHT, PULL_FROM_THE_HAT, GAMBLE_IT_ALL, CHEATER, WELL_RESTED,
} from '@cards/definitions/writer';
import { INK, WORDSMITH, WHITEBOARD } from '@cards/definitions/writer-persistents';
import type { CardId } from '@shared/index';

const enemyHp = (s: ReturnType<typeof buildTestState>) => s.enemies[0]!.hp;

describe('Craft — the bank', () => {
  it('accumulates and, unlike energy, survives the turn', () => {
    const state = buildTestState({ player: { energy: 5, hand: [PEN_STAB.id, PEN_STAB.id] } });
    const once = playFromHand(state, TEST_SELF, 0).state;
    expect(once.player.craft).toBe(2);
    const twice = playFromHand(once, TEST_SELF, 0).state;
    expect(twice.player.craft).toBe(4);
    const nextTurn = startTurn(twice, { draw: 0, resetEnergyTo: 1 }).state;
    expect(nextTurn.player.craft).toBe(4); // energy reset; Craft did not
    expect(nextTurn.player.energy).toBe(1);
  });
});

describe('Burn — Craft as a cost', () => {
  it('is a cost: without enough Craft the card cannot be played at all', () => {
    expect(burnCostOf(TYPE)).toBe(3);
    expect(burnCostOf(PEN_STAB)).toBe(0);
    const short = buildTestState({ player: { energy: 5, craft: 2, hand: [TYPE.id] } });
    expect(canPlayAt(short.player, 0)).toBe(false);
    const enough = buildTestState({ player: { energy: 5, craft: 3, hand: [TYPE.id] } });
    expect(canPlayAt(enough.player, 0)).toBe(true);
  });

  it('a Burn card costs Craft instead of energy', () => {
    const state = buildTestState({
      player: { energy: 1, craft: 5, hand: [TYPE.id, 'x' as CardId] },
      target: { hp: 30, maxHp: 30 },
    });
    expect(energyCostAt(state.player, 0)).toBe(0);
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.energy).toBe(1); // untouched
    expect(after.player.craft).toBe(2); // 5 - 3
    expect(enemyHp(after)).toBe(25);
  });

  it("an under-funded Burn can't sneak through the driver either", () => {
    const state = buildTestState({ player: { energy: 5, craft: 0, hand: [PLAYWRIGHT.id] } });
    expect(playFromHand(state, TEST_SELF, 0).state).toBe(state);
  });

  it('Pull From the Hat trades 5 Craft for 8', () => {
    const state = buildTestState({ player: { energy: 5, craft: 6, hand: [PULL_FROM_THE_HAT.id] } });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.craft).toBe(6 - 5 + 8);
  });

  it('Dumpster Diver burns the whole bank and deals exactly that much', () => {
    const state = buildTestState({
      player: { energy: 5, craft: 7, hand: [DUMPSTER_DIVER.id, 'x' as CardId] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.craft).toBe(0);
    expect(enemyHp(after)).toBe(23);
  });

  it("a later card can't read an earlier card's burn", () => {
    const state = buildTestState({
      player: { energy: 5, craft: 9, hand: [DUMPSTER_DIVER.id, DUMPSTER_DIVER.id] },
      target: { hp: 60, maxHp: 60 },
    });
    const first = playFromHand(state, TEST_SELF, 0).state;
    expect(enemyHp(first)).toBe(51); // burned all 9
    const second = playFromHand(first, TEST_SELF, 0).state;
    expect(enemyHp(second)).toBe(51); // nothing banked, so nothing dealt
  });
});

describe('Fading — cards that leave at end of turn', () => {
  it('is carried by cards whose text declares it, and stamped onto copies', () => {
    expect(printedKeywords(QUILL).fading).toBe(true);
    expect(printedKeywords(PEN_STAB).fading).toBe(false);
    const state = buildTestState({ player: { hand: [QUILL.id, PEN_STAB.id] } });
    expect(state.player.hand[0]!.fading).toBe(true);
    expect(state.player.hand[1]!.fading).toBeUndefined();
  });

  it('a Fading card left in hand is discarded when the turn ends', () => {
    const state = buildTestState({
      player: { hand: [QUILL.id, PEN_STAB.id], drawPile: ['a', 'b'] as CardId[] },
    });
    const { state: after } = endTurn(state);
    expect(cardIdsOf(after.player.hand)).toEqual([PEN_STAB.id]);
    expect(cardIdsOf(after.player.discardPile)).toEqual([QUILL.id]);
    expect(after.player.discardedThisTurn).toBe(1);
  });

  it('a Fading card that was played is already gone, so nothing double-discards', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [QUILL.id, PEN_STAB.id], drawPile: ['a'] as CardId[] },
    });
    const played = playFromHand(state, TEST_SELF, 0).state;
    const { state: after } = endTurn(played);
    expect(cardIdsOf(after.player.discardPile)).toEqual([QUILL.id]);
  });

  it('Search grants Fading to a card that did not have it', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [SEARCH.id, PEN_STAB.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.hand[0]!.fading).toBe(true);
    expect(enemyHp(after)).toBe(26);
  });

  it('Evade banks a point of Bravery per Fading card left in hand', () => {
    const state = buildTestState({
      // Evade itself is not Fading, so the three that count are Quill ×2 + Reframe.
      player: { energy: 5, craft: 4, hand: [EVADE.id, QUILL.id, QUILL.id, REFRAME.id] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.bravery).toBe(3);
    expect(after.player.craft).toBe(1); // 4 - Evade's Burn 3
  });
});

describe('Bravery — the first block/shield gain each turn', () => {
  it('boosts once per turn without being spent, and re-arms next turn', () => {
    const state = buildTestState({
      player: { energy: 5, bravery: 3, hand: [QUILL.id, QUILL.id], drawPile: [QUILL.id] as CardId[] },
    });
    const first = playFromHand(state, TEST_SELF, 0).state;
    expect(first.player.shield).toBe(4); // 1 + 3 bravery
    expect(first.player.bravery).toBe(3); // the boost spent nothing
    const second = playFromHand(first, TEST_SELF, 0).state;
    expect(second.player.shield).toBe(5); // just 1 — boosted only once this turn
    const nextTurn = startTurn(second, { draw: 1 }).state; // draws the third Quill
    const third = playFromHand(nextTurn, TEST_SELF, 0).state;
    expect(third.player.shield).toBe(5 + 1 + 3); // re-armed
  });

  it('Cheater converts all defense into Bravery; Gamble it All doubles and dumps', () => {
    const cheat = buildTestState({ player: { energy: 5, block: 2, shield: 4, hand: [CHEATER.id] } });
    const after = playFromHand(cheat, TEST_SELF, 0).state;
    expect(after.player.bravery).toBe(6);
    expect(after.player.block + after.player.shield).toBe(0);

    const gamble = buildTestState({
      player: { energy: 5, bravery: 4, block: 3, shield: 2, hand: [GAMBLE_IT_ALL.id] },
    });
    const gambled = playFromHand(gamble, TEST_SELF, 0).state;
    expect(gambled.player.bravery).toBe(8);
    expect(gambled.player.block + gambled.player.shield).toBe(0);
  });
});

describe('"Next turn, …" — promises paid at the start of the turn', () => {
  it('Trophy pays out its shields and craft one turn later, once', () => {
    const state = buildTestState({ player: { energy: 5, hand: [TROPHY.id], drawPile: ['a'] as CardId[] } });
    const played = playFromHand(state, TEST_SELF, 0).state;
    expect(played.player.shield).toBe(0);
    expect(played.player.craft).toBe(0);

    const next = startTurn(played, { draw: 0, resetEnergyTo: 1 }).state;
    expect(next.player.shield).toBe(2);
    expect(next.player.craft).toBe(3);

    const after = startTurn(next, { draw: 0, resetEnergyTo: 1 }).state;
    expect(after.player.shield).toBe(2); // not paid twice
    expect(after.player.craft).toBe(3);
  });

  it('Well Rested lands its energy after the turn-start reset, not before it', () => {
    const state = buildTestState({ player: { energy: 5, hand: [WELL_RESTED.id], drawPile: ['a'] as CardId[] } });
    const played = playFromHand(state, TEST_SELF, 0).state;
    const next = startTurn(played, { draw: 0, resetEnergyTo: 1 }).state;
    expect(next.player.energy).toBe(2); // base 1 + the promised 1
    expect(next.player.bravery).toBe(1);
  });
});

describe('the Writer persistents', () => {
  it('Ink and Wordsmith both fire once per Burn', () => {
    const state = buildTestState({
      player: { energy: 5, craft: 5, persistents: [INK.id, WORDSMITH.id], hand: [TYPE.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(enemyHp(after)).toBe(24); // Type's 5 + Ink's 1
    expect(after.player.shield).toBe(1); // Wordsmith
  });

  it('Whiteboard tops the bank up at the end of your turn', () => {
    const state = buildTestState({
      player: { persistents: [WHITEBOARD.id], hand: ['a'] as CardId[] },
    });
    expect(endTurn(state).state.player.craft).toBe(1);
  });

  it("Ink ignores an enemy's burn", () => {
    const base = buildTestState({ player: { persistents: [INK.id] }, target: { hp: 30, maxHp: 30 } });
    const enemy = base.enemies[0]!;
    const state = { ...base, enemies: [{ ...enemy, craft: 4 }] };
    const { state: after } = applyWithTriggers(state, { type: 'BurnCraft', target: enemy.id, amount: 2 });
    expect(after.player.hp).toBe(50);
    expect(enemyHp(after)).toBe(30); // Ink stayed quiet
  });

  it('a full Writer-vs-Writer battle runs headless without stalling', () => {
    // Half the deck is Burn cards the AI can only play with Craft banked; it
    // must never pick a play the engine then refuses (that would spin against
    // ENEMY_PLAY_CAP every turn).
    let state = confirmMulligan(
      newBattle({ character: 'writer', relicId: 'notebook', seed: 'writer-smoke', enemyCharacter: 'writer' }),
      [0, 1],
    ).state;
    expect(state.player.craft).toBe(3); // Notebook
    for (let turn = 0; turn < 12 && state.phase !== 'won' && state.phase !== 'lost'; turn++) {
      state = endPlayerTurn(state).state;
    }
    const hpMoved = state.player.hp < 20 || (state.enemies[0]?.hp ?? 20) < 20;
    expect(hpMoved || state.phase === 'won' || state.phase === 'lost').toBe(true);
  });
});
