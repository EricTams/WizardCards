/**
 * AST node types for the card language.
 *
 * A card's English text parses into three ordered lists:
 *   - `effects`   — immediate on-play statements ("Deal 6 damage.")
 *   - `triggers`  — ongoing rules ("Whenever you create a cloud, deal 1 …")
 *   - `modifiers` — static rule changes ("Snow clouds heal 2 instead of 1.")
 *
 * Everything a single effect needs is optional beyond `verb`, because effects
 * vary in shape: `Venom` has no amount, `Heal 3` has no noun, `Create 2 storm
 * clouds` carries a cloud type. The resolver validates the combination per verb.
 */
import type { CloudType, ScaleMetric } from '@shared/index';

/**
 * A scaled amount: the effect's `amount` (default 1) times a metric measured at
 * play time — "equal to your energy" (`{ per: 'energy' }`, no amount ⇒ ×1) or
 * "3 damage for each unique cloud" (`{ per: 'uniqueClouds' }`, amount 3).
 */
export interface ScaleSpec {
  readonly per: ScaleMetric;
}

export type Verb =
  // resource effects
  | 'deal'
  | 'gain'
  | 'heal'
  | 'poison'
  | 'draw'
  // cloud effects
  | 'create'
  | 'remove'
  | 'increase'
  // minion effects
  | 'discard'
  // bare keyword effects (no amount / noun)
  | 'venom'
  | 'drink'
  | 'minion';

/** Where a (trigger) effect's damage goes. On-play effects use the play context. */
export type EffectTarget = 'self' | 'allEnemies' | 'randomEnemy';

export interface EffectNode {
  readonly kind: 'Effect';
  readonly verb: Verb;
  /** e.g. 6 in "Deal 6 damage". Absent for keyword effects (venom/drink/minion). */
  readonly amount?: number;
  /** The noun the verb acts on: "damage", "shield", "energy", "cards", … */
  readonly noun?: string;
  /** For `create`: which cloud type to make. */
  readonly cloudType?: CloudType;
  /** When set, the amount scales off state ("equal to your energy"). */
  readonly scale?: ScaleSpec;
  /** Explicit target ("to all opponents"). Only meaningful inside triggers. */
  readonly target?: EffectTarget;
  /** Source span [start, end) so tools can map a node back to the text. */
  readonly start: number;
  readonly end: number;
}

/** The game moment a trigger fires on (maps to reducer GameEvents / turn phases). */
export type TriggerEventKind =
  | 'createCloud'
  | 'removeCloud'
  | 'dealUnblockedDamage'
  | 'discardMinion'
  | 'startTurn'
  | 'endTurn';

export type ConditionOp = 'gt' | 'gte';

/** A gate like "if you have over 3 energy". */
export interface TriggerCondition {
  readonly resource: string; // 'energy' | 'block' | 'poison' | 'hp' | …
  readonly op: ConditionOp;
  readonly amount: number;
}

export interface TriggerNode {
  readonly kind: 'Trigger';
  readonly event: TriggerEventKind;
  /** For `removeCloud`: only fire when this cloud type is removed. */
  readonly cloudType?: CloudType;
  readonly condition?: TriggerCondition;
  readonly effects: readonly EffectNode[];
  readonly start: number;
  readonly end: number;
}

/**
 * Static rule changes that aren't trigger→effect (Winter, Fall), plus `claw` —
 * a property of the card itself rather than of the board: a card with Claw plays
 * for free when it is discarded (resolved in `src/cards/match`).
 */
export interface ModifierNode {
  readonly kind: 'Modifier';
  readonly modifier: 'snowHealBonus' | 'suppressFogDiscard' | 'claw';
  readonly amount?: number;
  readonly start: number;
  readonly end: number;
}

export interface CardScript {
  readonly kind: 'CardScript';
  readonly effects: readonly EffectNode[];
  readonly triggers: readonly TriggerNode[];
  readonly modifiers: readonly ModifierNode[];
}
