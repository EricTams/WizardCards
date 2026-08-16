import { describe, it, expect } from 'vitest';
import { cardIdsOf } from '@engine/index';
import {
  buildTestState,
  playFromHand,
  canPlayAt,
  energyCostAt,
  startTurn,
  TEST_SELF,
  newBattle,
  confirmMulligan,
  endPlayerTurn,
} from '@cards/index';
import { printedKeywords } from '@cards/match/keywords';
import {
  PAPER, AIR, SWORDS_AT_THE_READY, PREPARATION, PRUNES, VIOLENT, DESTROY,
  SHARP_STRIKE, EVIL_GLARE, SIMPLE_SLASH, INTIMIDATE, MEND, DASH, CHALLENGE, RETIREMENT,
} from '@cards/definitions/old-lady';
import { SHARPEN, CROSSWORD, EXPLOSIVES, FLETCHING, REVENGE } from '@cards/definitions/old-lady-persistents';
import type { CardId } from '@shared/index';

const enemyHp = (s: ReturnType<typeof buildTestState>) => s.enemies[0]!.hp;

describe('Blank and Add — the window', () => {
  it('reads the printed keywords and stamps them onto copies', () => {
    expect(printedKeywords(PAPER).blank).toBe(true);
    expect(printedKeywords(SWORDS_AT_THE_READY).add).toBe(true);
    expect(printedKeywords(SHARP_STRIKE).add).toBe(false);
    const state = buildTestState({ player: { hand: [PAPER.id, SWORDS_AT_THE_READY.id, SHARP_STRIKE.id] } });
    expect(state.player.hand[0]!.blank).toBe(true);
    expect(state.player.hand[1]!.add).toBe(true);
    expect(state.player.hand[2]!.add).toBeUndefined();
  });

  it('an Add card is unplayable until a Blank opens the window, then free', () => {
    const state = buildTestState({
      player: { energy: 1, hand: [PAPER.id, SWORDS_AT_THE_READY.id] },
      target: { hp: 30, maxHp: 30 },
    });
    expect(canPlayAt(state.player, 1)).toBe(false);

    const opened = playFromHand(state, TEST_SELF, 0).state; // Paper: Blank
    expect(opened.player.addWindow).toBe(true);
    expect(opened.player.energy).toBe(0); // the Blank itself cost 1
    expect(canPlayAt(opened.player, 0)).toBe(true); // …and now Swords is free
    expect(energyCostAt(opened.player, 0)).toBe(0);

    const added = playFromHand(opened, TEST_SELF, 0).state;
    expect(enemyHp(added)).toBe(28);
    expect(added.player.energy).toBe(0); // still free
    expect(added.player.addWindow).toBe(true); // an Add keeps the window open
    expect(added.player.cardsAdded).toBe(1);
  });

  it('a card that is neither Blank nor Add shuts the window', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [PAPER.id, SHARP_STRIKE.id, PREPARATION.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const opened = playFromHand(state, TEST_SELF, 0).state;
    const closed = playFromHand(opened, TEST_SELF, 0).state; // Sharp Strike
    expect(closed.player.addWindow).toBe(false);
    expect(canPlayAt(closed.player, 0)).toBe(false); // Preparation is stuck again
  });

  it('the window never survives the turn', () => {
    const state = buildTestState({ player: { energy: 5, hand: [PAPER.id, PREPARATION.id] } });
    const opened = playFromHand(state, TEST_SELF, 0).state;
    const nextTurn = startTurn(opened, { draw: 0, resetEnergyTo: 1 }).state;
    expect(nextTurn.player.addWindow).toBe(false);
    expect(nextTurn.player.cardsAdded).toBe(0);
  });

  it('Prunes scales off how many Adds went into the window', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [PAPER.id, PREPARATION.id, VIOLENT.id, PRUNES.id] },
      target: { hp: 30, maxHp: 30 },
    });
    let s = playFromHand(state, TEST_SELF, 0).state; // Paper opens
    s = playFromHand(s, TEST_SELF, 0).state; // Preparation
    s = playFromHand(s, TEST_SELF, 0).state; // Violent
    s = playFromHand(s, TEST_SELF, 0).state; // Prunes — counting itself, 3 Adds
    expect(enemyHp(s)).toBe(27);
  });

  it('Retirement grants Add to a card that did not have it', () => {
    const state = buildTestState({
      player: { energy: 5, power: 3, hand: [RETIREMENT.id, SHARP_STRIKE.id] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.power).toBe(1);
    expect(after.player.hand[0]!.add).toBe(true);
    expect(canPlayAt(after.player, 0)).toBe(false); // …and so it's window-only now
  });
});

describe('Power — the first attack each turn', () => {
  it('adds to exactly one attack, and is not spent doing it', () => {
    const state = buildTestState({
      player: { energy: 5, power: 3, hand: [EVIL_GLARE.id, EVIL_GLARE.id] },
      target: { hp: 40, maxHp: 40 },
    });
    const first = playFromHand(state, TEST_SELF, 0).state;
    expect(enemyHp(first)).toBe(32); // 5 + 3 power
    expect(first.player.power).toBe(3); // the charge stays
    const second = playFromHand(first, TEST_SELF, 0).state;
    expect(enemyHp(second)).toBe(27); // just 5 this time
  });

  it('decays by 1 at the start of your turn, and never goes below zero', () => {
    const state = buildTestState({ player: { power: 2, hand: ['a'] as CardId[] } });
    // Every turn here runs a full upkeep (an energy reset), unlike turn 1.
    const t1 = startTurn(state, { draw: 0, resetEnergyTo: 1 }).state;
    expect(t1.player.power).toBe(1);
    const t2 = startTurn(t1, { draw: 0, resetEnergyTo: 1 }).state;
    expect(t2.player.power).toBe(0);
    const t3 = startTurn(t2, { draw: 0, resetEnergyTo: 1 }).state;
    expect(t3.player.power).toBe(0);
  });

  it('Explosives stops the decay', () => {
    const state = buildTestState({
      player: { power: 4, persistents: [EXPLOSIVES.id], hand: ['a'] as CardId[] },
    });
    const next = startTurn(state, { draw: 0, resetEnergyTo: 1 }).state;
    expect(next.player.power).toBe(4);
  });

  it('re-arms next turn, so the buff pays out again', () => {
    const state = buildTestState({
      player: { energy: 5, power: 5, hand: [EVIL_GLARE.id], drawPile: [EVIL_GLARE.id] as CardId[] },
      target: { hp: 40, maxHp: 40 },
    });
    const hit = playFromHand(state, TEST_SELF, 0).state; // 5 + 5
    expect(enemyHp(hit)).toBe(30);
    const next = startTurn(hit, { draw: 1, resetEnergyTo: 5 }).state; // power decays to 4
    const again = playFromHand(next, TEST_SELF, 0).state;
    expect(enemyHp(again)).toBe(21); // 5 + 4
  });

  it('Simple Slash spends a point of Power; Intimidate buys two', () => {
    const state = buildTestState({
      player: { energy: 5, power: 2, hand: [INTIMIDATE.id, SIMPLE_SLASH.id] },
      target: { hp: 40, maxHp: 40 },
    });
    const buffed = playFromHand(state, TEST_SELF, 0).state;
    expect(buffed.player.power).toBe(4);
    const slashed = playFromHand(buffed, TEST_SELF, 0).state;
    expect(enemyHp(slashed)).toBe(32); // 4 damage + 4 power
    expect(slashed.player.power).toBe(3); // then loses 1
  });

  it('Mend cashes all Power in as healing', () => {
    const state = buildTestState({
      player: { energy: 5, hp: 10, maxHp: 50, power: 6, hand: [MEND.id] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.hp).toBe(16);
    expect(after.player.power).toBe(0);
  });

  it('Dash reads the Blanks in hand; Challenge arms the table too', () => {
    const dash = buildTestState({
      player: { energy: 5, hand: [DASH.id, PAPER.id, AIR.id, SHARP_STRIKE.id] },
    });
    expect(playFromHand(dash, TEST_SELF, 0).state.player.power).toBe(2);

    const challenge = buildTestState({ player: { energy: 5, hand: [CHALLENGE.id] } });
    const { state: after } = playFromHand(challenge, TEST_SELF, 0);
    expect(after.player.power).toBe(3);
    expect(after.enemies[0]!.power).toBe(1);
  });
});

describe('the Old Lady persistents', () => {
  it('Sharpen turns every self-inflicted wound into Power', () => {
    const state = buildTestState({
      player: { energy: 5, hp: 30, maxHp: 40, persistents: [SHARPEN.id], hand: [EVIL_GLARE.id] },
      target: { hp: 40, maxHp: 40 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.hp).toBe(29);
    expect(after.player.power).toBe(1);
  });

  it('Crossword pays out when a Blank card is played', () => {
    const state = buildTestState({
      player: { energy: 3, persistents: [CROSSWORD.id], hand: [PAPER.id, SHARP_STRIKE.id] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.energy).toBe(3 - 1 + 1);
  });

  it('Fletching buys a point of Power with a point of HP each turn', () => {
    const state = buildTestState({
      player: { hp: 30, maxHp: 40, persistents: [FLETCHING.id], hand: ['a'] as CardId[] },
    });
    // Power decays by 1 first, then Fletching's start-of-turn effect adds one back.
    const next = startTurn(state, { draw: 0, resetEnergyTo: 1 }).state;
    expect(next.player.hp).toBe(29);
    expect(next.player.power).toBe(1);
  });

  it('Revenge fires once per Add card played', () => {
    const state = buildTestState({
      player: { energy: 5, persistents: [REVENGE.id], hand: [PAPER.id, PREPARATION.id, DESTROY.id] },
      target: { hp: 30, maxHp: 30 },
    });
    let s = playFromHand(state, TEST_SELF, 0).state; // Paper — not an Add
    expect(enemyHp(s)).toBe(30);
    s = playFromHand(s, TEST_SELF, 0).state; // Preparation
    s = playFromHand(s, TEST_SELF, 0).state; // Destroy
    expect(enemyHp(s)).toBe(28);
  });

  it('a full Old Lady battle runs headless without stalling on unplayable Adds', () => {
    // Roughly a third of the pool is Add cards the AI can only play inside a
    // Blank window; it must never offer one the engine then refuses.
    let state = confirmMulligan(
      newBattle({ character: 'oldLady', relicId: 'earring', seed: 'old-lady-smoke', enemyCharacter: 'oldLady' }),
      [0, 1],
    ).state;
    expect(state.player.power).toBe(2); // Earring
    for (let turn = 0; turn < 12 && state.phase !== 'won' && state.phase !== 'lost'; turn++) {
      state = endPlayerTurn(state).state;
    }
    const hpMoved = state.player.hp < 20 || (state.enemies[0]?.hp ?? 20) < 20;
    expect(hpMoved || state.phase === 'won' || state.phase === 'lost').toBe(true);
    // Her hand does grow: Add cards pile up until a Blank turns up to spend
    // them, and the design's 10-card hand cap is not implemented for anyone yet
    // (see docs/roadmap.md) — so this only guards that cards keep flowing.
    expect(cardIdsOf(state.player.hand).length).toBeGreaterThan(0);
  });
});
