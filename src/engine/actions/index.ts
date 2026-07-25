/**
 * Atomic actions — the ONLY way GameState ever changes.
 *
 * Two tiers, both serializable:
 *   - Moves/Intents: what a player requests ("play card 3 at enemy 1"). Validated
 *     against the rules, then expanded into atomic actions. (Added later.)
 *   - Atomic actions (below): the smallest deterministic mutations. The reducer
 *     knows how to apply each one. A card's resolved effects are a list of these.
 *
 * Every action is a plain, JSON-serializable object with a `type` discriminant.
 * The ordered log of applied actions IS the game — replay it against
 * initialState(seed) and you reproduce any state exactly.
 */
import type { CardId, CloudType, EntityId, ScaleMetric } from '@shared/index';
import type { Phase } from '@engine/state/index';

export interface StartTurn {
  readonly type: 'StartTurn';
}

export interface EndTurn {
  readonly type: 'EndTurn';
}

/** Set the battle phase directly (mulligan/player/enemy/won/lost). */
export interface SetPhase {
  readonly type: 'SetPhase';
  readonly phase: Phase;
}

/** Clear a combatant's temporary block (done at the start of their turn). */
export interface ClearBlock {
  readonly type: 'ClearBlock';
  readonly target: EntityId;
}

/**
 * Zero the per-turn counters a combatant accumulates (today just the discard
 * count the Crab scales off). Run alongside ClearBlock at the start of a turn.
 */
export interface ClearTurnCounters {
  readonly type: 'ClearTurnCounters';
  readonly target: EntityId;
}

/** Move `count` cards from the end of `owner`'s hand to their discard pile. */
export interface DiscardCards {
  readonly type: 'DiscardCards';
  /** Whose hand to discard from. Defaults to the player when omitted. */
  readonly owner?: EntityId;
  readonly count: number;
}

/**
 * Discard `owner`'s whole hand. A real discard, so it counts toward the turn's
 * discard total and sets off Claw on every card that carries it — which is the
 * point of the Crab cards that use it.
 */
export interface DiscardHand {
  readonly type: 'DiscardHand';
  /** Whose hand. Defaults to the player when omitted. */
  readonly owner?: EntityId;
}

/** Move a specific card from `owner`'s hand (by index) to their discard pile. */
export interface MoveHandCardToDiscard {
  readonly type: 'MoveHandCardToDiscard';
  /** Whose hand. Defaults to the player when omitted. */
  readonly owner?: EntityId;
  readonly index: number;
  /**
   * Why the card is leaving hand — it rides along on the `CardsDiscarded` event
   * so discard triggers can tell these apart. `'play'` (the default) is a card
   * being played; `'setup'` is the opening mulligan, which happens before the
   * battle and so must not set off Claw.
   */
  readonly reason?: 'play' | 'setup';
}

/**
 * Deal damage to one random living *opponent* (Storm cloud, etc.). Perspective
 * is set by `self`: opponents are the other side (enemies of the player, or the
 * player if `self` is an enemy). Defaults to the player's opponents when omitted.
 */
export interface DealDamageToRandomEnemy {
  readonly type: 'DealDamageToRandomEnemy';
  readonly self?: EntityId;
  readonly amount: number;
}

/**
 * Deal `multiplier × metric(self)` damage, where the metric is measured at reduce
 * time — "Deal damage equal to your energy", "Deal 3 damage for each unique cloud".
 */
export interface DealDamageScaled {
  readonly type: 'DealDamageScaled';
  readonly self: EntityId;
  readonly target: EntityId;
  readonly per: ScaleMetric;
  readonly multiplier: number;
}

/** Put a persistent (ongoing) card into a combatant's play area. */
export interface AddPersistent {
  readonly type: 'AddPersistent';
  readonly target: EntityId;
  readonly cardId: CardId;
}

export interface DrawCards {
  readonly type: 'DrawCards';
  /** Whose deck to draw from. Defaults to the player when omitted. */
  readonly owner?: EntityId;
  readonly count: number;
}

export interface DealDamage {
  readonly type: 'DealDamage';
  readonly target: EntityId;
  readonly amount: number;
}

export interface GainBlock {
  readonly type: 'GainBlock';
  readonly target: EntityId;
  readonly amount: number;
}

/** Persistent damage soak (vs. GainBlock's temporary soak). */
export interface GainShield {
  readonly type: 'GainShield';
  readonly target: EntityId;
  readonly amount: number;
}

export interface Heal {
  readonly type: 'Heal';
  readonly target: EntityId;
  readonly amount: number;
}

export interface GainEnergy {
  readonly type: 'GainEnergy';
  readonly target: EntityId;
  readonly amount: number;
}

/** Set a combatant's energy to an exact value (used to reset to base each turn). */
export interface SetEnergy {
  readonly type: 'SetEnergy';
  readonly target: EntityId;
  readonly amount: number;
}

/** Increase a combatant's stored Poison X-value (the Wizard mechanic). */
export interface GainPoison {
  readonly type: 'GainPoison';
  readonly target: EntityId;
  readonly amount: number;
}

export interface GainPower {
  readonly type: 'GainPower';
  readonly target: EntityId;
  readonly amount: number;
}

export interface GainBravery {
  readonly type: 'GainBravery';
  readonly target: EntityId;
  readonly amount: number;
}

/** Create `count` clouds of one type in a combatant's cloud area. */
export interface CreateClouds {
  readonly type: 'CreateClouds';
  readonly target: EntityId;
  readonly cloudType: CloudType;
  readonly count: number;
}

/** Remove up to `count` clouds (most-recently-created first for now). */
export interface RemoveClouds {
  readonly type: 'RemoveClouds';
  readonly target: EntityId;
  readonly count: number;
}

/** Remove the single cloud at `index` (how the cloud-cap replacement picks one). */
export interface RemoveCloudAt {
  readonly type: 'RemoveCloudAt';
  readonly target: EntityId;
  readonly index: number;
}

/**
 * Venom: deal damage equal to the caster's Poison to `target`, then set the
 * caster's Poison to 0. The "equal to your Poison" scaling is resolved here, at
 * reduce time, so it stays deterministic and needs no play-time state peek.
 */
export interface Venom {
  readonly type: 'Venom';
  readonly self: EntityId;
  readonly target: EntityId;
}

/** Drink: gain Block equal to the caster's Poison, then set Poison to 0. */
export interface Drink {
  readonly type: 'Drink';
  readonly self: EntityId;
}

/** Summon a minion that is a copy of `cardId`, owned by `owner`. */
export interface SummonMinion {
  readonly type: 'SummonMinion';
  readonly owner: EntityId;
  readonly cardId: CardId;
}

/** Discard up to `count` of the owner's minions (most-recently-summoned first). */
export interface DiscardMinion {
  readonly type: 'DiscardMinion';
  readonly owner: EntityId;
  readonly count: number;
}

/** The discriminated union of every atomic action the engine understands. */
export type Action =
  | StartTurn
  | EndTurn
  | SetPhase
  | ClearBlock
  | DiscardCards
  | MoveHandCardToDiscard
  | AddPersistent
  | DrawCards
  | DealDamage
  | DealDamageToRandomEnemy
  | DealDamageScaled
  | GainBlock
  | GainShield
  | Heal
  | GainEnergy
  | SetEnergy
  | GainPoison
  | GainPower
  | GainBravery
  | CreateClouds
  | RemoveClouds
  | RemoveCloudAt
  | Venom
  | Drink
  | SummonMinion
  | DiscardMinion
  | ClearTurnCounters
  | DiscardHand;

export type ActionType = Action['type'];
