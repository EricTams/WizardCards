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

export interface StartTurn {
  readonly type: 'StartTurn';
}

export interface EndTurn {
  readonly type: 'EndTurn';
}

/** Clear a combatant's temporary block (done at the start of their turn). */
export interface ClearBlock {
  readonly type: 'ClearBlock';
  readonly target: EntityId;
}

/** Move `count` cards from the top... end of the player's hand to the discard pile. */
export interface DiscardCards {
  readonly type: 'DiscardCards';
  readonly count: number;
}

/** Deal damage to one enemy chosen via the in-state RNG (Storm cloud, etc.). */
export interface DealDamageToRandomEnemy {
  readonly type: 'DealDamageToRandomEnemy';
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
  | ClearBlock
  | DiscardCards
  | AddPersistent
  | DrawCards
  | DealDamage
  | DealDamageToRandomEnemy
  | DealDamageScaled
  | GainBlock
  | GainShield
  | Heal
  | GainEnergy
  | GainPoison
  | GainPower
  | GainBravery
  | CreateClouds
  | RemoveClouds
  | Venom
  | Drink
  | SummonMinion
  | DiscardMinion;

export type ActionType = Action['type'];
