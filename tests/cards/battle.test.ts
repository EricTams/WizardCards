import { describe, it, expect } from 'vitest';
import {
  newBattle,
  confirmMulligan,
  playFromHand,
  endPlayerTurn,
  endPlayerPhase,
  beginEnemyTurn,
  beginPlayerTurn,
  enemyPlayOne,
  aiPlayOne,
  PLAYER_ID,
  ENEMY_ID,
  OPENING_HAND,
  OPENING_DISCARD,
  DECK_SIZE,
  type BattleOptions,
} from '@cards/index';
import { initialState, makeCombatant, type Combatant, type GameState } from '@engine/index';
import type { EntityId } from '@shared/index';
import { SHINE, CRISSCROSS, RAIN } from '@cards/definitions/cloud';

const OPTS: BattleOptions = { character: 'cloud', relicId: 'old-shield', seed: 'battle-1' };

describe('battle setup', () => {
  it('deals both sides an opening hand; the enemy mulligans to 3, the player awaits input', () => {
    const s = newBattle(OPTS);
    expect(s.phase).toBe('mulligan');
    expect(s.player.hand).toHaveLength(OPENING_HAND); // player still holds 5; discards in confirmMulligan
    expect(s.enemies[0]!.hand).toHaveLength(OPENING_HAND - OPENING_DISCARD); // enemy already dropped 2
    expect(s.enemies[0]!.discardPile).toHaveLength(OPENING_DISCARD);
    // 20-card deck, minus the 5 drawn, live in the draw pile.
    expect(s.player.drawPile).toHaveLength(DECK_SIZE - OPENING_HAND);
  });

  it('applies a relic at combat start (Old Shield → 5 shields)', () => {
    expect(newBattle(OPTS).player.shield).toBe(5);
  });

  it('mulligan discards the chosen cards and begins turn 1', () => {
    const { state } = confirmMulligan(newBattle(OPTS), [0, 1]);
    expect(state.phase).toBe('playerTurn');
    expect(state.turn).toBe(1);
    expect(state.player.hand).toHaveLength(OPENING_HAND - 2);
    expect(state.player.discardPile).toHaveLength(2);
  });
});

/** Build a controlled mid-battle state (bypassing the random opening). */
function craft(player: Partial<Combatant>, enemy: Partial<Combatant>): GameState {
  const base = initialState({ seed: 'craft', deck: [] });
  const mk = (id: EntityId, name: string, o: Partial<Combatant>): Combatant =>
    makeCombatant({ ...o, id, name, hp: o.hp ?? 20, maxHp: o.maxHp ?? 20 });
  return {
    ...base,
    phase: 'playerTurn',
    turn: 1,
    player: mk(PLAYER_ID, 'P', player),
    enemies: [mk(ENEMY_ID, 'E', enemy)],
  };
}

describe('playing cards', () => {
  it('spends energy, discards the card, and deals damage', () => {
    const state = craft({ energy: 1, hand: [SHINE.id] }, { hp: 12 });
    const { state: after } = playFromHand(state, PLAYER_ID, 0, ENEMY_ID);
    expect(after.enemies[0]!.hp).toBe(6); // Shine deals 6
    expect(after.player.energy).toBe(0);
    expect(after.player.hand).toHaveLength(0);
    expect(after.player.discardPile).toContain(SHINE.id);
  });

  it('refuses a card the actor cannot afford', () => {
    const state = craft({ energy: 0, hand: [SHINE.id] }, {});
    const { state: after } = playFromHand(state, PLAYER_ID, 0, ENEMY_ID);
    expect(after).toBe(state); // unchanged
  });

  it('wins when the last enemy hits 0 HP', () => {
    const state = craft({ energy: 1, hand: [SHINE.id] }, { hp: 4 });
    const { state: after } = playFromHand(state, PLAYER_ID, 0, ENEMY_ID);
    expect(after.enemies[0]!.hp).toBe(0);
    expect(after.phase).toBe('won');
  });
});

describe('ending the turn', () => {
  it('runs the enemy turn and can kill the player (lose)', () => {
    // Player at 1 HP, enemy holds a lethal attack and no other cards.
    const state = craft({ hp: 1, energy: 1, hand: [] }, { energy: 1, hand: [CRISSCROSS.id], drawPile: [], discardPile: [] });
    const { state: after } = endPlayerTurn(state);
    expect(after.player.hp).toBeLessThanOrEqual(0);
    expect(after.phase).toBe('lost');
  });

  it('hands control back to the player when nobody has died', () => {
    const state = craft({ hp: 20, energy: 1, hand: [] }, { hp: 20, energy: 1, hand: [], drawPile: [] });
    const { state: after } = endPlayerTurn(state);
    expect(after.phase).toBe('playerTurn');
    expect(after.turn).toBe(2);
  });
});

describe('random enemy AI (enemyPlayOne)', () => {
  const enemyTurn = (over: Partial<Combatant>): GameState => ({
    ...craft({ hp: 20 }, over),
    phase: 'enemyTurn',
  });

  it('plays a valid card at the player and consumes it', () => {
    const s = enemyTurn({ energy: 1, hand: [SHINE.id], drawPile: [] });
    const r = enemyPlayOne(s);
    expect(r).not.toBeNull();
    expect(r!.cardId).toBe(SHINE.id);
    expect(r!.state.player.hp).toBeLessThan(20); // hit the player
    expect(r!.state.enemies[0]!.hand).toHaveLength(0); // card left hand
  });

  it('returns null when nothing is affordable', () => {
    expect(enemyPlayOne(enemyTurn({ energy: 0, hand: [SHINE.id], drawPile: [] }))).toBeNull();
  });

  it('returns null outside the enemy turn', () => {
    const s = craft({ hand: [] }, { energy: 1, hand: [SHINE.id], drawPile: [] }); // playerTurn
    expect(enemyPlayOne(s)).toBeNull();
  });

  it('is deterministic per state but spreads its choice across the hand', () => {
    const base = enemyTurn({ energy: 1, hand: [SHINE.id, CRISSCROSS.id, RAIN.id], drawPile: [] });
    expect(enemyPlayOne(base)!.cardId).toBe(enemyPlayOne(base)!.cardId); // same state ⇒ same pick
    const picks = new Set<string>();
    for (let i = 0; i < 24; i++) picks.add(enemyPlayOne({ ...base, rng: 101 + i * 977 })!.cardId as string);
    expect(picks.size).toBeGreaterThan(1); // not always the same card
  });
});

describe('battle determinism', () => {
  it('same seed + same moves => identical, serializable state', () => {
    const run = () => endPlayerTurn(confirmMulligan(newBattle(OPTS), [0, 1]).state).state;
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});

describe('AI vs AI (Attract Mode)', () => {
  it('aiPlayOne drives the player side too', () => {
    const s = craft({ energy: 1, hand: [SHINE.id], drawPile: [] }, { hp: 12 });
    const r = aiPlayOne(s, PLAYER_ID);
    expect(r).not.toBeNull();
    expect(r!.state.enemies[0]!.hp).toBe(6); // Shine hit the enemy
  });

  it('newBattle builds a real Wizard-vs-Cloud mirror match', () => {
    const s = newBattle({ character: 'wizard', relicId: '', seed: 'm', enemyCharacter: 'cloud' });
    expect(s.player.character).toBe('wizard');
    expect(s.enemies[0]!.character).toBe('cloud');
    // Every card is accounted for across the piles (the enemy's 2 mulligan
    // discards live in its discard pile).
    const total = (c: Combatant) => c.drawPile.length + c.hand.length + c.discardPile.length;
    expect(total(s.player)).toBe(DECK_SIZE);
    expect(total(s.enemies[0]!)).toBe(DECK_SIZE);
  });

  // Headless version of the UI's attract conductor (no delays).
  function simulateAttract(seed: string): GameState {
    const done = (s: GameState) => s.phase === 'won' || s.phase === 'lost';
    let cur = confirmMulligan(newBattle({ character: 'wizard', relicId: '', seed, enemyCharacter: 'cloud' }), [0, 1]).state;
    for (let round = 0; round < 400 && !done(cur); round++) {
      if (cur.phase === 'playerTurn') {
        let p = aiPlayOne(cur, PLAYER_ID);
        while (p) {
          cur = p.state;
          if (done(cur)) break;
          p = aiPlayOne(cur, PLAYER_ID);
        }
        if (!done(cur)) cur = endPlayerPhase(cur).state;
      } else if (cur.phase === 'enemyTurn') {
        cur = beginEnemyTurn(cur).state;
        let p = aiPlayOne(cur, ENEMY_ID);
        while (p) {
          cur = p.state;
          if (done(cur)) break;
          p = aiPlayOne(cur, ENEMY_ID);
        }
        if (!done(cur)) cur = beginPlayerTurn(cur).state;
      } else break;
    }
    return cur;
  }

  it('plays a full match to a winner, deterministically', () => {
    const a = simulateAttract('attract-1');
    const b = simulateAttract('attract-1');
    expect(['won', 'lost']).toContain(a.phase); // someone won within the cap
    expect(a).toEqual(b); // same seed ⇒ identical match
  });
});
