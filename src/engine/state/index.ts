/**
 * GameState — the single source of truth.
 *
 * INVARIANT: everything here is plain, JSON-serializable data. No class
 * instances, no functions, no Date/Map/Set in the tree. `structuredClone` and
 * `JSON.stringify` must round-trip it losslessly. This is what lets us snapshot,
 * send over the wire, and diff state for free.
 *
 * The combat model is still growing toward `reference/design.md`. Today a
 * Combatant carries the per-character resources the Cloud and Wizard cards need
 * (clouds, poison, energy, shields, minions, …); turn structure, energy economy,
 * and the trigger system that makes clouds/minions *act* are still to come (see
 * `docs/roadmap.md`).
 */
import type { CardId, CharacterId, CloudType, EntityId } from '@shared/index';
import { seedRng, type RngState } from '@engine/rng/index';

/**
 * Battle phases. `mulligan` is the opening draw-5/discard-2 step; `playerTurn`
 * and `enemyTurn` alternate until one side hits 0 HP (`won`/`lost`).
 */
export type Phase = 'setup' | 'mulligan' | 'playerTurn' | 'enemyTurn' | 'won' | 'lost';

/** A summoned minion in play. References the card it was summoned from. */
export interface MinionState {
  /** Unique instance id, minted deterministically from `GameState.idSeq`. */
  readonly id: EntityId;
  /** The card this minion is a copy of (its effects replay while in play). */
  readonly cardId: CardId;
}

export interface Combatant {
  readonly id: EntityId;
  readonly name: string;
  /**
   * Which character this combatant is (drives hero/deck art in the UI). Optional
   * so the many test/sandbox construction sites don't have to specify it.
   */
  readonly character?: CharacterId;
  readonly hp: number;
  readonly maxHp: number;
  /** Temporary damage soak. Design: cleared each turn (turn structure is later). */
  readonly block: number;
  /** Persistent damage soak. Design: stays until spent. */
  readonly shield: number;
  /** Spare energy/mana this combatant has to play more cards. */
  readonly energy: number;
  /** The Wizard's stored X-value; Venom/Drink spend it. */
  readonly poison: number;
  /** The Old Lady's damage buff (modelled here so any combatant can carry it). */
  readonly power: number;
  /** The Writer's block/damage burst charge. */
  readonly bravery: number;
  /**
   * Cards discarded since this combatant's turn began — the Crab scales off it
   * ("deal 1 damage for each card discarded this turn"). Reset by `StartTurn`.
   */
  readonly discardedThisTurn: number;
  /** Cloud tokens in play (the Cloud's mechanic). */
  readonly clouds: readonly CloudType[];
  /**
   * Extra cloud slots this combatant has earned above the base cap (Outburst,
   * Spatial Reasoning). Only the *bonus* lives here: the base cap is a game rule
   * belonging to the cards layer, which the engine must not know about.
   */
  readonly bonusMaxClouds: number;
  /** Minions in play (the Wizard's mechanic). */
  readonly minions: readonly MinionState[];
  /**
   * Persistent (ongoing) cards this combatant has in play. Their trigger
   * behavior is resolved by the turn/trigger orchestration in the cards layer
   * (`src/cards/match`), not by the engine reducer.
   */
  readonly persistents: readonly CardId[];
  /**
   * This combatant's own card piles. Every combatant carries its own deck so the
   * enemy can draw and play cards through the exact same reducer as the player —
   * the model the design's symmetric/multiplayer play needs. Ordered lists of
   * CardIds referencing the card registry.
   */
  readonly drawPile: readonly CardId[];
  readonly hand: readonly CardId[];
  readonly discardPile: readonly CardId[];
  readonly exhaustPile: readonly CardId[];
}

/**
 * Build a Combatant, filling every resource with its zero value. Callers give
 * the identity/health fields (and may override any resource); this keeps the
 * many construction sites from having to spell out every field as the model grows.
 */
export function makeCombatant(
  props: Pick<Combatant, 'id' | 'name' | 'hp' | 'maxHp'> & Partial<Combatant>,
): Combatant {
  return {
    block: 0,
    shield: 0,
    energy: 0,
    poison: 0,
    power: 0,
    bravery: 0,
    discardedThisTurn: 0,
    clouds: [],
    bonusMaxClouds: 0,
    minions: [],
    persistents: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    ...props,
  };
}

export interface GameState {
  /** Format/schema version — lets us migrate saved games and netcode payloads. */
  readonly version: 1;
  /** The RNG cursor. Advancing randomness means producing a new state with a new value here. */
  readonly rng: RngState;
  /** Monotonic counter for minting deterministic instance ids (minions, …). */
  readonly idSeq: number;
  readonly phase: Phase;
  readonly turn: number;
  /** The human player. Their card piles live on the combatant (`player.hand`, …). */
  readonly player: Combatant;
  /** The opponents. Each carries its own piles too, so they play like the player. */
  readonly enemies: readonly Combatant[];
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
    idSeq: 0,
    phase: 'setup',
    turn: 0,
    player: makeCombatant({
      id: 'player' as EntityId,
      name: 'Player',
      hp: 50,
      maxHp: 50,
      drawPile: opts.deck.slice(),
    }),
    enemies: [],
  };
}
