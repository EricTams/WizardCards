/**
 * The Card Lab "arena" — a sandbox GameState you configure with targets and play
 * cards against. Setting up a scenario is separate from in-game moves, so these
 * helpers construct plain state directly (not via atomic actions). They stay pure
 * so they can be unit-tested; playing a card still goes through the engine reducer.
 */
import { initialState, makeCombatant, type Combatant, type GameState } from '@engine/index';
import { entityId, type EntityId } from '@shared/index';

const DEFAULT_HP = 30;

function makeTarget(index: number): Combatant {
  return makeCombatant({
    id: entityId(`target-${index}`),
    name: `Target ${index + 1}`,
    hp: DEFAULT_HP,
    maxHp: DEFAULT_HP,
  });
}

/** A fresh arena: a full-health player and one target, ready for the player's turn. */
export function makeArena(): GameState {
  return {
    ...initialState({ seed: 'cardlab', deck: [] }),
    phase: 'playerTurn',
    enemies: [makeTarget(0)],
  };
}

/** Add a target, giving it the lowest free `target-N` id so ids stay stable. */
export function addTarget(state: GameState): GameState {
  const used = new Set(state.enemies.map((e) => e.id as string));
  let i = 0;
  while (used.has(`target-${i}`)) i++;
  return { ...state, enemies: [...state.enemies, makeTarget(i)] };
}

export function removeTarget(state: GameState, id: EntityId): GameState {
  return { ...state, enemies: state.enemies.filter((e) => e.id !== id) };
}
