import { describe, it, expect } from 'vitest';
import { buildTestState, playFromHand, startTurn, TEST_SELF } from '@cards/index';
import {
  STICKY_POISON,
  SACRIFICE,
  VIAL,
  EXPLOSION,
  PILE_UP,
  GUARD_DOG,
  HOSTILE,
  CURSE,
  ALCHEMY,
} from '@cards/definitions/wizard';
import { PROTECT_THE_DRINKS, JUGGLE } from '@cards/definitions/wizard-persistents';
import { entityId, type CardId } from '@shared/index';
import type { MinionState } from '@engine/index';

const minion = (id: CardId, n: number): MinionState => ({ id: entityId(`m${n}`), cardId: id });

describe('retaining poison', () => {
  it('Sticky Poison deals its Venom without spending the X-value', () => {
    const state = buildTestState({
      player: { energy: 5, poison: 7, hand: [STICKY_POISON.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.enemies[0]!.hp).toBe(23); // 7 damage
    expect(after.player.poison).toBe(7); // …and kept
  });

  it('an ordinary Venom still spends it', () => {
    const state = buildTestState({
      player: { energy: 5, poison: 7, hand: [HOSTILE.id] },
      target: { hp: 30, maxHp: 30 },
    });
    expect(playFromHand(state, TEST_SELF, 0).state.player.poison).toBe(0);
  });

  it('Sacrifice arms the NEXT Venom, however many cards later', () => {
    let s = buildTestState({
      player: { energy: 9, poison: 0, hand: [SACRIFICE.id, CURSE.id, HOSTILE.id] },
      target: { hp: 60, maxHp: 60 },
    });
    s = playFromHand(s, TEST_SELF, 0).state; // Poison 6, arm retain
    expect(s.player.poison).toBe(6);
    expect(s.player.venomRetains).toBe(true);

    s = playFromHand(s, TEST_SELF, 0).state; // Curse: +5, still armed
    expect(s.player.venomRetains).toBe(true);

    s = playFromHand(s, TEST_SELF, 0).state; // Hostile: Venom keeps it, Drink spends it
    expect(s.player.venomRetains).toBe(false); // the arming was consumed
  });
});

describe('scaling the resource verbs', () => {
  it('Vial poisons per card played this turn, counting itself', () => {
    const state = buildTestState({
      player: { energy: 9, poison: 0, hand: [CURSE.id, VIAL.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const afterCurse = playFromHand(state, TEST_SELF, 0).state;
    expect(afterCurse.player.cardsPlayedThisTurn).toBe(1);

    const after = playFromHand(afterCurse, TEST_SELF, 0).state;
    expect(after.player.poison).toBe(5 + 2); // Curse's 5, then 1 per card played (2)
  });

  it('Pile Up shields per minion that has been discarded', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [PILE_UP.id], minionsDiscarded: 3 },
    });
    expect(playFromHand(state, TEST_SELF, 0).state.player.shield).toBe(3);
  });

  it('Explosion doubles poison, empties the hand and the board', () => {
    const state = buildTestState({
      player: {
        energy: 5,
        poison: 4,
        hand: ['x' as CardId, EXPLOSION.id],
        minions: [minion(ALCHEMY.id, 1), minion(ALCHEMY.id, 2)],
      },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 1);
    expect(after.player.poison).toBe(8);
    // The emptied hand triggers the run-out-of-cards refill, which reshuffles
    // the two discarded cards straight back — the board stays empty, though.
    expect(after.player.hand).toHaveLength(2);
    expect(after.player.minions).toHaveLength(0);
  });
});

describe('minion replay', () => {
  it('Guard Dog summons and hits, then repeats on the next turn', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [GUARD_DOG.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const played = playFromHand(state, TEST_SELF, 0).state;
    expect(played.enemies[0]!.hp).toBe(29);
    expect(played.player.minions).toHaveLength(1);

    const next = startTurn(played, { draw: 0, resetEnergyTo: 0 }).state;
    expect(next.enemies[0]!.hp).toBe(28); // replayed its 1 damage
    expect(next.player.block).toBe(2); // and its block, after the turn's clear
  });

  it('Protect the Drinks replays each minion one extra time', () => {
    const base = { minions: [minion(ALCHEMY.id, 1)], poison: 0 };
    const plain = startTurn(buildTestState({ player: base }), { draw: 0 }).state;
    expect(plain.player.poison).toBe(1);

    const boosted = startTurn(
      buildTestState({ player: { ...base, persistents: [PROTECT_THE_DRINKS.id] } }),
      { draw: 0 },
    ).state;
    expect(boosted.player.poison).toBe(2);
  });

  it('Juggle blocks once per replay, extra passes included', () => {
    const one = startTurn(
      buildTestState({ player: { minions: [minion(ALCHEMY.id, 1)], persistents: [JUGGLE.id] } }),
      { draw: 0 },
    ).state;
    expect(one.player.block).toBe(1);

    const two = startTurn(
      buildTestState({
        player: {
          minions: [minion(ALCHEMY.id, 1)],
          persistents: [JUGGLE.id, PROTECT_THE_DRINKS.id],
        },
      }),
      { draw: 0 },
    ).state;
    expect(two.player.block).toBe(2); // one per replay
  });
});
