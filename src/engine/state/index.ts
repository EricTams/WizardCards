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

/**
 * One physical copy of a card, as it sits in a pile.
 *
 * Piles hold these rather than bare CardIds because a *copy* can carry state its
 * card does not: the Crab grants Claw to a specific card in your hand, and only
 * that copy gains it. `uid` is minted from `GameState.idSeq`, so identity is
 * deterministic and survives a replay.
 */
export interface CardInstance {
  readonly uid: number;
  readonly cardId: CardId;
  /** Granted by Dungeon-ness / Skitter / Decorator — this copy only. */
  readonly claw?: boolean;
}

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
  /** Cards played since this combatant's turn began (Vial). Reset with the others. */
  readonly cardsPlayedThisTurn: number;
  /**
   * How many of this combatant's minions have been discarded — the design's
   * "minions in your Discard Pile" (Pile Up). A running total, since discarded
   * minions are not kept as objects anywhere.
   */
  readonly minionsDiscarded: number;
  /**
   * Set by Sacrifice / Sticky Poison: the next Venom keeps the caster's Poison
   * instead of spending it. Consumed by that Venom.
   */
  readonly venomRetains: boolean;
  /** Cloud tokens in play (the Cloud's mechanic). */
  readonly clouds: readonly CloudType[];
  /**
   * Extra cloud slots this combatant has earned above the base cap (Outburst,
   * Spatial Reasoning). Only the *bonus* lives here: the base cap is a game rule
   * belonging to the cards layer, which the engine must not know about.
   */
  readonly bonusMaxClouds: number;
  /**
   * Set by Solar Power: this combatant's clouds fire twice on their next turn.
   * Consumed by the start-of-turn cascade after the second firing.
   */
  readonly cloudsPlayTwice: boolean;
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
  readonly drawPile: readonly CardInstance[];
  readonly hand: readonly CardInstance[];
  readonly discardPile: readonly CardInstance[];
  readonly exhaustPile: readonly CardInstance[];
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
    cardsPlayedThisTurn: 0,
    minionsDiscarded: 0,
    venomRetains: false,
    clouds: [],
    bonusMaxClouds: 0,
    cloudsPlayTwice: false,
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

/** The card ids in a pile, in order — for callers that don't care about copies. */
export function cardIdsOf(pile: readonly CardInstance[]): CardId[] {
  return pile.map((c) => c.cardId);
}

/**
 * Wrap card ids as fresh instances, numbering them from `idSeq`. Returns the
 * next `idSeq` so the caller can thread it back into GameState — uids stay
 * unique and deterministic across a whole battle.
 */
export function instancesOf(
  ids: readonly CardId[],
  idSeq: number,
): { cards: CardInstance[]; idSeq: number } {
  const cards = ids.map((cardId, i) => ({ uid: idSeq + i, cardId }));
  return { cards, idSeq: idSeq + ids.length };
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
    idSeq: opts.deck.length,
    player: makeCombatant({
      id: 'player' as EntityId,
      name: 'Player',
      hp: 50,
      maxHp: 50,
      drawPile: instancesOf(opts.deck, 0).cards,
    }),
    enemies: [],
  };
}
