/**
 * engine — public API surface.
 *
 * Everything the outer layers (cards, ui) are allowed to touch is re-exported
 * here. Keeping a single entry point makes the pure core's contract explicit and
 * easy to keep stable. The engine imports only from `shared`.
 */
export type { GameState, Combatant, MinionState, Phase, NewGameOptions } from '@engine/state/index';
export { initialState, makeCombatant } from '@engine/state/index';

export type { Action, ActionType } from '@engine/actions/index';

export type { GameEvent, ApplyResult } from '@engine/reducers/index';
export { apply, applyAll, metricValue } from '@engine/reducers/index';

export type { RngState } from '@engine/rng/index';
export { seedRng, nextFloat, nextInt, shuffle } from '@engine/rng/index';
