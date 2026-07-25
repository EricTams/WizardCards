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
  randomMatchup,
  CHARACTERS,
  DECK_SIZE,
  CLOUD_CAP,
  type BattleOptions,
} from '@cards/index';
import { pileOf } from '@cards/index';
import { cardIdsOf } from '@engine/index';
import { apply, initialState, makeCombatant, type Combatant, type GameState } from '@engine/index';
import { cardId, entityId, type CardId, type EntityId } from '@shared/index';
import { SHINE, CRISSCROSS, RAIN, HURRICANE } from '@cards/definitions/cloud';

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

  it('Seashell replaces the opening draw (6 instead of 5), keeping the same mulligan', () => {
    const s = newBattle({ character: 'crab', relicId: 'seashell', seed: 'battle-shell' });
    expect(s.player.hand).toHaveLength(OPENING_HAND + 1);
    expect(s.player.drawPile).toHaveLength(DECK_SIZE - (OPENING_HAND + 1));
    // The enemy's opening is untouched by the player's relic.
    expect(s.enemies[0]!.hand).toHaveLength(OPENING_HAND - OPENING_DISCARD);

    // Still discards the usual 2 — the relic's value is the extra card kept.
    const { state } = confirmMulligan(s, [0, 1]);
    expect(state.player.hand).toHaveLength(OPENING_HAND + 1 - OPENING_DISCARD);
  });

  it('randomMatchup always pairs two different characters, and is seed-stable', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const m = randomMatchup(`seed-${i}`);
      expect(m.character).not.toBe(m.enemyCharacter);
      expect(CHARACTERS[m.character]).toBeDefined();
      expect(CHARACTERS[m.enemyCharacter]).toBeDefined();
      seen.add(m.character);
      seen.add(m.enemyCharacter);
    }
    // Every playable character turns up across a decent sample.
    expect(seen.size).toBe(Object.keys(CHARACTERS).length);
    // Same seed, same matchup — an odd demo round can be reproduced.
    expect(randomMatchup('repeat')).toEqual(randomMatchup('repeat'));
  });

  it('builds a real battle from a random matchup', () => {
    const m = randomMatchup('attract-1');
    const s = newBattle({ ...m, relicId: '', seed: 'attract-1' });
    expect(s.player.character).toBe(m.character);
    expect(s.enemies[0]!.character).toBe(m.enemyCharacter);
  });

  it('mulligan discards the chosen cards and begins turn 1', () => {
    const { state } = confirmMulligan(newBattle(OPTS), [0, 1]);
    expect(state.phase).toBe('playerTurn');
    expect(state.turn).toBe(1);
    expect(state.player.hand).toHaveLength(OPENING_HAND - 2);
    expect(state.player.discardPile).toHaveLength(2);
  });
});

/** Combatant overrides whose piles are given as card ids. */
type CraftOver = Omit<Partial<Combatant>, 'hand' | 'drawPile' | 'discardPile'> & {
  hand?: readonly CardId[];
  drawPile?: readonly CardId[];
  discardPile?: readonly CardId[];
};

/** Build a controlled mid-battle state (bypassing the random opening). */
function craft(player: CraftOver, enemy: CraftOver): GameState {
  const base = initialState({ seed: 'craft', deck: [] });
  // Piles are named by card id here, as in the other fixtures.
  const mk = (id: EntityId, name: string, o: CraftOver): Combatant =>
    makeCombatant({
      ...o,
      id,
      name,
      hp: o.hp ?? 20,
      maxHp: o.maxHp ?? 20,
      hand: pileOf(...(o.hand ?? [])),
      drawPile: pileOf(...(o.drawPile ?? [])),
      discardPile: pileOf(...(o.discardPile ?? [])),
    });
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
    expect(cardIdsOf(after.player.discardPile)).toContain(SHINE.id);
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
  const enemyTurn = (over: CraftOver): GameState => ({
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

describe('minions as attack targets', () => {
  const M = entityId('m1');
  const withMinion = (): GameState => {
    const base = initialState({ seed: 'mt', deck: [] });
    return {
      ...base,
      phase: 'playerTurn',
      turn: 1,
      player: makeCombatant({ id: PLAYER_ID, name: 'P', hp: 20, maxHp: 20, minions: [{ id: M, cardId: cardId('x') }] }),
      enemies: [makeCombatant({ id: ENEMY_ID, name: 'E', hp: 20, maxHp: 20 })],
    };
  };

  it('an attack targeting a minion discards it and spares the hero', () => {
    const r = apply(withMinion(), { type: 'DealDamage', target: M, amount: 6 });
    expect(r.state.player.minions).toHaveLength(0);
    expect(r.state.player.hp).toBe(20); // hero untouched
    expect(r.events.some((e) => e.type === 'MinionDiscarded')).toBe(true);
  });

  it('the AI spreads fire between the hero and minions', () => {
    // Enemy holds an attack; the player (defender) has one minion.
    const base: GameState = {
      ...withMinion(),
      phase: 'enemyTurn',
      enemies: [makeCombatant({ id: ENEMY_ID, name: 'E', hp: 20, maxHp: 20, energy: 1, hand: pileOf(SHINE.id) })],
    };
    let killedMinion = 0;
    let hitHero = 0;
    for (let i = 0; i < 24; i++) {
      const r = aiPlayOne({ ...base, rng: 5 + i * 211 }, ENEMY_ID);
      if (!r) continue;
      if (r.state.player.minions.length === 0) killedMinion++;
      else if (r.state.player.hp < 20) hitHero++;
    }
    expect(killedMinion).toBeGreaterThan(0); // sometimes the minion soaks it
    expect(hitHero).toBeGreaterThan(0); // sometimes the hero takes it
  });
});

describe('cloud cap', () => {
  it('the AI never holds more than CLOUD_CAP clouds', () => {
    // Enemy already at the cap plays a card that creates 2 more → trims back down.
    const s: GameState = {
      ...craft({ hp: 20 }, { energy: 1, hand: [HURRICANE.id], clouds: ['storm', 'snow', 'fog'], drawPile: [] }),
      phase: 'enemyTurn',
    };
    const r = aiPlayOne(s, ENEMY_ID);
    expect(r).not.toBeNull();
    expect(r!.state.enemies[0]!.clouds.length).toBe(CLOUD_CAP);
    // it keeps the freshly-created clouds (drops the oldest)
    expect(r!.state.enemies[0]!.clouds).toContain('storm');
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
