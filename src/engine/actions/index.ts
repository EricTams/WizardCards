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
import type { EntityId } from '@shared/index';

export interface StartTurn {
  readonly type: 'StartTurn';
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

/** The discriminated union of every atomic action the engine understands. */
export type Action = StartTurn | DrawCards | DealDamage | GainBlock;

export type ActionType = Action['type'];
