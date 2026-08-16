/**
 * GameState — the single source of truth.
 *
 * INVARIANT: everything here is plain, JSON-serializable data. No class
 * instances, no functions, no Date/Map/Set in the tree. `structuredClone` and
 * `JSON.stringify` must round-trip it losslessly. This is what lets us snapshot,
 * send over the wire, and diff state for free.
 *
 * A Combatant carries every character's resources at once — clouds, poison,
 * craft, power, bravery, minions — because the engine is character-agnostic and
 * a combatant is just whichever of them are non-zero. What those resources
 * *mean* (when Power decays, what a cloud does) is a game rule and lives one
 * layer up in `src/cards/match` (see `docs/triggers.md`).
 */
import type { CardId, CharacterId, CloudType, EntityId, Marks } from '@shared/index';
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
   * The Old Lady's **Add**: this copy can't be played normally — only while a
   * Blank card has opened the Add window, and then for free.
   *
   * Unlike `molt`, the per-copy keyword flags below cover BOTH the printed
   * keyword and a granted one (Retirement, Search): the reducer
   * selects and counts by the flag alone and can't read card text, so the cards
   * layer stamps printed keywords onto every copy it creates (see
   * `stampPrintedKeywords` in `src/cards/match/keywords.ts`). A copy minted by a
   * future engine-side "create a copy" effect would miss the stamp; create
   * copies from an existing instance and the marks ride along.
   */
  readonly add?: boolean;
  /** The Old Lady's **Blank**: playing it opens the Add window. Printed only. */
  readonly blank?: boolean;
  /** The Writer's **Fading**: discarded if still in hand at the end of the turn. */
  readonly fading?: boolean;
  /**
   * The Knight's **Markings** on this copy — `{ sharp: 2 }`. Applied when the
   * card is played, and then lost (see `src/cards/match/marks.ts`).
   */
  readonly marks?: Marks;
}

/** A summoned minion in play. References the card it was summoned from. */
export interface MinionState {
  /** Unique instance id, minted deterministically from `GameState.idSeq`. */
  readonly id: EntityId;
  /** The card this minion is a copy of (its effects replay while in play). */
  readonly cardId: CardId;
}

/**
 * Resources a card has promised a combatant for the start of its next turn.
 * A flat record (not a list of pending effects) so the state stays trivially
 * serializable and two cards promising the same resource simply add up.
 */
export interface NextTurnBonus {
  readonly energy: number;
  readonly power: number;
  readonly bravery: number;
  readonly craft: number;
  readonly shield: number;
}

/** Every next-turn resource at zero — the value a fresh combatant carries. */
export const NO_NEXT_TURN: NextTurnBonus = { energy: 0, power: 0, bravery: 0, craft: 0, shield: 0 };

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
  /**
   * The Old Lady's damage buff (modelled here so any combatant can carry it):
   * the FIRST attack of your turn deals this much extra. Decays by 1 each turn.
   */
  readonly power: number;
  /**
   * Whether Power's bonus has boosted an attack this turn — "the first time you
   * attack an enemy on your turn". Reset by `ClearTurnCounters`.
   */
  readonly powerApplied: boolean;
  /** The Writer's block/damage burst charge. */
  readonly bravery: number;
  /**
   * Whether Bravery's bonus has boosted a block/shield gain this turn — the
   * design's "the FIRST block card you play gives you X additional block".
   * Reset by `ClearTurnCounters` at the start of the turn.
   */
  readonly braveryApplied: boolean;
  /**
   * The Writer's stored Craft. Unlike energy it does NOT reset each turn — Burn
   * cards spend it instead of energy.
   */
  readonly craft: number;
  /**
   * Craft spent by the Burn on the card currently resolving, so "deal damage
   * equal to the craft burnt this way" (Dumpster Diver) can read it. Reset by
   * `NoteCardPlayed`, so each play starts from zero.
   */
  readonly craftBurned: number;
  /**
   * The Old Lady's Blank window: while open, Add cards may be played, for free.
   * A Blank card opens it; any card that is neither Blank nor Add closes it.
   */
  readonly addWindow: boolean;
  /** Add cards played into the window that is currently open (Prunes). */
  readonly cardsAdded: number;
  /**
   * Resources owed at the start of this combatant's next turn — the design's
   * "Next turn, gain 2 Shields and Craft 3" (Trophy, Well Rested, Destroy, Mind
   * Games). Granted and then zeroed by the start-of-turn cascade.
   */
  readonly nextTurn: NextTurnBonus;
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
   * hits zero, draw 3" — Brain Jar makes it 4). Like `bonusMaxClouds`,
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
    powerApplied: false,
    bravery: 0,
    braveryApplied: false,
    craft: 0,
    craftBurned: 0,
    addWindow: false,
    cardsAdded: 0,
    nextTurn: NO_NEXT_TURN,
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
 * A choice the battle is waiting on: "choose `count` cards to discard"
 * (Quicksand, the Fog penalty), "…clouds to remove" (the design's 'X clouds,
 * your choice'), "…minions to discard" (Throw, Hurl), or "…cards from your
 * discard pile" (Dry Out). While set, the resolution that raised it is
 * suspended — `queued` holds the not-yet-applied remainder of that resolution
 * as plain actions, so the pause itself survives serialization and replay. The
 * cards layer raises it (`SetPendingChoice`) only for a human player with a
 * real choice to make; the AI always auto-resolves.
 *
 * Picks are numbers whose meaning follows the kind: card `uid`s for
 * hand/discard-pile kinds (`discard`/`recover`), and plain indices for
 * `cloud`/`minion` (clouds and minions have no uids).
 */
export interface PendingChoice {
  readonly kind: 'discard' | 'cloud' | 'minion' | 'recover';
  readonly owner: EntityId;
  /** How many picks must be made. */
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
