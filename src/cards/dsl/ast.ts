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
import type { CloudType, MarkKind, ScaleMetric } from '@shared/index';

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
  /** The Old Lady's self-inflicted costs: "lose 2 HP", "lose 1 power". */
  | 'lose'
  // cloud effects
  | 'create'
  | 'remove'
  | 'increase'
  | 'fill'
  | 'double'
  | 'retain'
  // pile movement
  | 'return'
  | 'shuffle'
  | 'move'
  | 'add'
  // minion effects
  | 'discard'
  // the Writer's mechanics
  | 'craft'
  | 'burn'
  | 'set'
  /** The Knight's Markings: "mark 2 cards in your hand with sharp 1". */
  | 'mark'
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
  /** Explicit target ("to all opponents"). */
  readonly target?: EffectTarget;
  /** For `mark`: which Marking, and which cards in hand to put it on. */
  readonly mark?: MarkKind | 'random';
  readonly scope?: 'hand' | 'random' | 'all';
  /**
   * How many *cards* an effect acts on, where `amount` is already the effect's
   * value: "mark 2 cards with sharp 1" is `count: 2, amount: 1`.
   */
  readonly count?: number;
  /**
   * Set on effects from a "Next turn, …" sentence: rather than happening now,
   * the resource is promised for the start of the caster's next turn.
   */
  readonly when?: 'nextTurn';
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
  | 'minionReplayed'
  | 'discardCard'
  | 'discardMoltCard'
  | 'shuffleDeck'
  /** The Writer: "when you Burn, …" — Craft spent, whatever spent it. */
  | 'burn'
  /** The Old Lady: "when you lose HP on your turn, …" (Sharpen). */
  | 'loseHp'
  /** The Old Lady: "when you Add a card, …" (Revenge). */
  | 'addCard'
  /** The Old Lady: "when you play a Blank card, …" (Crossword). */
  | 'playBlankCard'
  /** The Knight: "when you play a card Marked with Sharp, …" (Engrave). */
  | 'playMarkedCard'
  | 'startTurn'
  | 'endTurn';

export type ConditionOp = 'gt' | 'gte' | 'lt' | 'lte';

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
  /** For `playMarkedCard`: only fire for this Marking. */
  readonly mark?: MarkKind;
  readonly condition?: TriggerCondition;
  readonly effects: readonly EffectNode[];
  readonly start: number;
  readonly end: number;
}

/**
 * Static rule changes that aren't trigger→effect (Winter, Fall, Explosives),
 * plus the per-copy card keywords — properties of the card itself rather than of
 * the board: a Molt card plays for free when discarded, a Blank card opens the
 * Add window, an Add card can only be played inside one, and a Fading card is
 * discarded if it's still in hand at end of turn (all in `src/cards/match`).
 */
export interface ModifierNode {
  readonly kind: 'Modifier';
  readonly modifier:
    | 'snowHealBonus'
    | 'suppressFogDiscard'
    | 'suppressPowerDecay'
    | 'minionReplayBonus'
    | 'venomKeepsHalf'
    | 'fireCloudsOnRemoval'
    | 'molt'
    | 'blank'
    | 'add'
    | 'fading';
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
