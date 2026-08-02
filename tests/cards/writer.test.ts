import { describe, it, expect } from 'vitest';
import { cardIdsOf } from '@engine/index';
import { buildTestState, playFromHand, canPlayAt, startTurn, TEST_SELF, newBattle, confirmMulligan, endPlayerTurn } from '@cards/index';
import { applyWithTriggers } from '@cards/match/index';
import { hasUnplayable, burnCostOf } from '@cards/match/burn';
import {
  PEN_STAB, DISPOSE, DUMPSTER_DIVER, NOTES, SCRIBBLE, REFRAME, TROPHY, QUILL,
  TRASH_CAN, TYPE, JUNK, WRITER_REFRESH, PLAYWRIGHT,
} from '@cards/definitions/writer';
import { INK, PAPER_TRAIL } from '@cards/definitions/writer-persistents';
import type { CardId } from '@shared/index';

const enemyHp = (s: ReturnType<typeof buildTestState>) => s.enemies[0]!.hp;

describe('Unplayable — reading the keyword', () => {
  it('is carried by cards whose text declares it, and not by others', () => {
    expect(hasUnplayable(NOTES)).toBe(true);
    expect(hasUnplayable(DISPOSE)).toBe(true);
    expect(hasUnplayable(PEN_STAB)).toBe(false);
  });

  it('is stamped onto copies, so fixtures and battles carry the flag', () => {
    const state = buildTestState({ player: { hand: [NOTES.id, PEN_STAB.id] } });
    expect(state.player.hand[0]!.unplayable).toBe(true);
    expect(state.player.hand[1]!.unplayable).toBeUndefined();
  });

  it('cannot be played from hand', () => {
    const state = buildTestState({ player: { energy: 5, hand: [NOTES.id] } });
    expect(canPlayAt(state.player, 0)).toBe(false);
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after).toEqual(state); // a refused play changes nothing
  });
});

describe('Burn — spending Unplayable cards for their effects', () => {
  it('burn is a cost: without enough Unplayable cards the Burn card is unplayable', () => {
    expect(burnCostOf(TROPHY)).toBe(2);
    expect(burnCostOf(PEN_STAB)).toBe(0);
    const short = buildTestState({ player: { energy: 5, hand: [TROPHY.id, NOTES.id] } });
    expect(canPlayAt(short.player, 0)).toBe(false); // only 1 of the 2 required
    const enough = buildTestState({ player: { energy: 5, hand: [TROPHY.id, NOTES.id, NOTES.id] } });
    expect(canPlayAt(enough.player, 0)).toBe(true);
  });

  it('burned cards play their effects for free, on top of the burner\'s own', () => {
    // Dumpster Diver: "Burn 1. Deal 2 damage." burns Dispose ("Deal 4 damage.")
    // The filler card keeps the hand non-empty, so the run-out-of-cards refill
    // stays out of this test's way.
    const state = buildTestState({
      player: { energy: 1, hand: [DISPOSE.id, DUMPSTER_DIVER.id, 'x' as CardId] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 1);
    expect(enemyHp(after)).toBe(24); // Dispose's 4 + Dumpster Diver's 2
    expect(after.player.energy).toBe(0); // only the burner cost energy
    expect(cardIdsOf(after.player.hand)).toEqual(['x']);
    expect(cardIdsOf(after.player.discardPile).sort()).toEqual([DISPOSE.id, DUMPSTER_DIVER.id].sort());
  });

  it('burns leftmost-first and leaves playable cards alone', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [REFRAME.id, SCRIBBLE.id, NOTES.id, PLAYWRIGHT.id] },
      target: { hp: 30, maxHp: 30 },
    });
    // Playwright: "Burn 1. Gain 3 energy." — burns Scribble (leftmost Unplayable),
    // whose "Gain 1 energy." fires too.
    const { state: after } = playFromHand(state, TEST_SELF, 3);
    expect(cardIdsOf(after.player.hand)).toEqual([REFRAME.id, NOTES.id]);
    expect(after.player.energy).toBe(5 - 1 + 3 + 1);
  });

  it('a burned Junk hits every opponent', () => {
    const state = buildTestState({
      player: { energy: 1, hand: [JUNK.id, DUMPSTER_DIVER.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 1);
    expect(enemyHp(after)).toBe(27); // Junk's 1 to all + Dumpster Diver's 2
  });

  it('Refresh burns 3 and redraws 3', () => {
    const state = buildTestState({
      player: {
        energy: 1,
        hand: [NOTES.id, NOTES.id, SCRIBBLE.id, WRITER_REFRESH.id],
        drawPile: ['a', 'b', 'c'] as CardId[],
      },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 3);
    expect(after.player.hand).toHaveLength(3); // the fresh a/b/c
    expect(after.player.shield).toBe(4); // two burned Notes: 2 + 2 shields
    expect(after.player.energy).toBe(1 - 1 + 1); // Scribble's burned energy
  });
});

describe('Find — draw and read what came up', () => {
  it('keeps all cards drawn and only fires the rider on an Unplayable hit', () => {
    // Covered per-card in card-tests.ts; here: the flag resets between plays.
    const state = buildTestState({
      player: { energy: 5, hand: [TYPE.id, QUILL.id], drawPile: [NOTES.id] as CardId[] },
      target: { hp: 30, maxHp: 30 },
    });
    const found = playFromHand(state, TEST_SELF, 0).state; // Type finds Notes
    expect(enemyHp(found)).toBe(28);
    // Quill has no Find; the stale "found" must not leak into a later rider.
    expect(found.player.unplayablesFound).toBe(1);
    const next = playFromHand(found, TEST_SELF, 0).state;
    expect(next.player.unplayablesFound).toBe(0); // reset when Quill was played
  });
});

describe('Trash Can — granting Unplayable', () => {
  it('marks copies, which then refuse to play and can be Burned', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [REFRAME.id, PEN_STAB.id, TRASH_CAN.id] },
    });
    const marked = playFromHand(state, TEST_SELF, 2).state;
    expect(marked.player.hand.map((c) => c.unplayable === true)).toEqual([true, true]);
    expect(marked.player.energy).toBe(5 - 1 + 1);
    expect(canPlayAt(marked.player, 0)).toBe(false); // Reframe is junk now
    // And Burn will happily spend the marked Reframe — its effects fire: it
    // deals its 3 and draws 2, which reshuffles the discard (Trash Can AND the
    // burned Reframe itself, still marked) right back into hand.
    const burned = applyWithTriggers(marked, { type: 'BurnCards', owner: TEST_SELF, count: 1 }).state;
    expect(enemyHp(burned)).toBe(50 - 3);
    expect(cardIdsOf(burned.player.hand).sort()).toEqual([PEN_STAB.id, REFRAME.id, TRASH_CAN.id].sort());
    expect(burned.player.hand.find((c) => c.cardId === REFRAME.id)!.unplayable).toBe(true);
  });
});

describe('Bravery — the first block/shield gain each turn', () => {
  it('boosts once per turn without being spent, and re-arms next turn', () => {
    const state = buildTestState({
      player: { energy: 5, bravery: 3, hand: [QUILL.id, QUILL.id], drawPile: [QUILL.id] as CardId[] },
    });
    const first = playFromHand(state, TEST_SELF, 0).state;
    expect(first.player.shield).toBe(7); // 4 + 3 bravery
    expect(first.player.bravery).toBe(4); // Quill's +1; the boost spent nothing
    const second = playFromHand(first, TEST_SELF, 0).state;
    expect(second.player.shield).toBe(11); // just 4 — boosted only once this turn
    const nextTurn = startTurn(second, { draw: 1 }).state; // draws the third Quill
    const third = playFromHand(nextTurn, TEST_SELF, 0).state;
    expect(third.player.shield).toBe(11 + 4 + 5); // re-armed, now at 5 bravery
  });
});

describe('the Writer persistents', () => {
  it('Ink fires per burned card, hitting every opponent', () => {
    const state = buildTestState({
      player: { persistents: [INK.id], hand: [NOTES.id, SCRIBBLE.id] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = applyWithTriggers(state, { type: 'BurnCards', owner: TEST_SELF });
    expect(enemyHp(after)).toBe(26); // 2 damage × 2 burned cards
    expect(after.player.shield).toBe(2); // the burned Notes still resolved
  });

  it('Paper Trail draws a replacement for each Unplayable card drawn', () => {
    const state = buildTestState({
      player: { persistents: [PAPER_TRAIL.id], drawPile: [NOTES.id, 'x', 'y'] as CardId[] },
    });
    const { state: after } = applyWithTriggers(state, { type: 'DrawCards', owner: TEST_SELF, count: 1 });
    expect(after.player.hand).toHaveLength(2); // Notes + the bonus 'x'
  });

  it('a full Writer-vs-Writer battle runs headless without stalling', () => {
    // Both sides hold Unplayable cards; the AI must never pick a play the
    // engine refuses (that would spin against ENEMY_PLAY_CAP every turn).
    let state = confirmMulligan(
      newBattle({ character: 'writer', relicId: 'gel-pen', seed: 'writer-smoke', enemyCharacter: 'writer' }),
      [0, 1],
    ).state;
    expect(state.player.bravery).toBe(1); // Gel Pen
    for (let turn = 0; turn < 12 && state.phase !== 'won' && state.phase !== 'lost'; turn++) {
      state = endPlayerTurn(state).state;
    }
    // The battle progressed: someone took damage or it outright ended.
    const hpMoved = state.player.hp < 20 || (state.enemies[0]?.hp ?? 20) < 20;
    expect(hpMoved || state.phase === 'won' || state.phase === 'lost').toBe(true);
  });

  it("Paper Trail ignores an enemy Writer's draws", () => {
    const base = buildTestState({ player: { persistents: [PAPER_TRAIL.id], drawPile: ['x'] as CardId[] } });
    const enemy = base.enemies[0]!;
    const state = {
      ...base,
      enemies: [{ ...enemy, drawPile: [{ uid: 9000, cardId: NOTES.id, unplayable: true }] }],
    };
    const { state: after } = applyWithTriggers(state, { type: 'DrawCards', owner: enemy.id, count: 1 });
    expect(after.player.hand).toHaveLength(0); // no bonus draw for the player
  });
});
