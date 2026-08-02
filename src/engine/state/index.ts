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
import type { Action } from '@engine/actions/index';
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
 * card does not: the Crab grants Molt to a specific card in your hand, and only
 * that copy gains it. `uid` is minted from `GameState.idSeq`, so identity is
 * deterministic and survives a replay.
 */
export interface CardInstance {
  readonly uid: number;
  readonly cardId: CardId;
  /** Granted by Dungeon-ness / Skitter / Decorator — this copy only. */
  readonly molt?: boolean;
  /**
   * This copy cannot be played from hand; Burn spends it for its effects.
   * Unlike `molt`, this flag covers BOTH the printed keyword and a granted one
   * (Trash Can): the reducer selects Burn targets and counts Find hits by this
   * flag alone, so the cards layer stamps printed Unplayable onto every copy it
   * creates (see `stampPrintedKeywords` in `src/cards/match/burn.ts`).
   */
  readonly unplayable?: boolean;
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
   * Whether Bravery's bonus has boosted a block/shield gain this turn — the
   * design's "the FIRST block card you play gives you X additional block".
   * Reset by `ClearTurnCounters` at the start of the turn.
   */
  readonly braveryApplied: boolean;
  /**
   * How many Unplayable cards the last Find drew — "If you find an unplayable
   * card, …" riders read it (`IfFoundUnplayable`). Reset by `NoteCardPlayed`,
   * so each card play starts with a clean slate.
   */
  readonly unplayablesFound: number;
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
   * Extra cards drawn by the run-out-of-cards refill ("the moment your hand
   * hits zero, draw 3" — Brain in a Jar makes it 4). Like `bonusMaxClouds`,
   * only the bonus lives here; the base 3 is a cards-layer rule (`HAND_REFILL`)
   * and the refill itself is orchestrated there (`src/cards/match`).
   */
  readonly bonusRefillDraw: number;
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
    braveryApplied: false,
    unplayablesFound: 0,
    discardedThisTurn: 0,
    cardsPlayedThisTurn: 0,
    minionsDiscarded: 0,
    venomRetains: false,
    clouds: [],
    bonusMaxClouds: 0,
    bonusRefillDraw: 0,
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

/**
 * A card choice the battle is waiting on: "choose `count` cards to discard"
 * (Quicksand, the Fog penalty) or "…to burn" (the Writer). While set, the
 * resolution that raised it is suspended — `queued` holds the not-yet-applied
 * remainder of that resolution as plain actions, so the pause itself survives
 * serialization and replay. The cards layer raises it (`SetPendingChoice`) only
 * for a human player with a real choice to make; the AI always auto-resolves.
 */
export interface PendingChoice {
  readonly kind: 'discard' | 'burn';
  readonly owner: EntityId;
  /** How many cards must be picked. */
  readonly count: number;
  /** The suspended remainder of the interrupted resolution. */
  readonly queued: readonly Action[];
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
  /** A card choice the battle is paused on, if any (see PendingChoice). */
  readonly pending?: PendingChoice;
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
