/**
 * GameState — the single source of truth.
 *
 * INVARIANT: everything here is plain, JSON-serializable data. No class
 * instances, no functions, no Date/Map/Set in the tree. `structuredClone` and
 * `JSON.stringify` must round-trip it losslessly. This is what lets us snapshot,
 * send over the wire, and diff state for free.
 *
 * This is placeholder shape for the walking skeleton — enough to demonstrate the
 * pattern. Real combat/entity modeling comes later.
 */
import type { CardId, EntityId } from '@shared/index';
import { seedRng, type RngState } from '@engine/rng/index';

export type Phase = 'setup' | 'playerTurn' | 'enemyTurn' | 'won' | 'lost';

export interface Combatant {
  readonly id: EntityId;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly block: number;
}

export interface GameState {
  /** Format/schema version — lets us migrate saved games and netcode payloads. */
  readonly version: 1;
  /** The RNG cursor. Advancing randomness means producing a new state with a new value here. */
  readonly rng: RngState;
  readonly phase: Phase;
  readonly turn: number;
  readonly player: Combatant;
  readonly enemies: readonly Combatant[];
  /** Card piles are ordered lists of CardIds referencing the card registry. */
  readonly drawPile: readonly CardId[];
  readonly hand: readonly CardId[];
  readonly discardPile: readonly CardId[];
  readonly exhaustPile: readonly CardId[];
}

export interface NewGameOptions {
  readonly seed: string | number;
  readonly deck: readonly CardId[];
}

/** Build a fresh, deterministic initial state from a seed and a starting deck. */
export function initialState(opts: NewGameOptions): GameState {
  return {
    version: 1,
    rng: seedRng(opts.seed),
    phase: 'setup',
    turn: 0,
    player: {
      id: 'player' as EntityId,
      name: 'Wizard',
      hp: 50,
      maxHp: 50,
      block: 0,
    },
    enemies: [],
    drawPile: opts.deck.slice(),
    hand: [],
    discardPile: [],
    exhaustPile: [],
  };
}
