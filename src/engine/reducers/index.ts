/**
 * The reducer: apply(state, action) => { state, events }
 *
 * CONTRACT:
 *   - Pure: no I/O, no Math.random, no Date, no mutation of the input.
 *   - Total: every Action variant is handled (the switch is exhaustive).
 *   - Deterministic: all randomness flows through state.rng.
 *
 * `events` describe what happened (damage dealt, cards drawn) so the display can
 * animate without ever inspecting or owning game state. The UI renders `state`
 * and reacts to `events`; it never mutates either.
 */
import type { CardId, EntityId } from '@shared/index';
import type { GameState } from '@engine/state/index';
import type { Action } from '@engine/actions/index';
import { shuffle } from '@engine/rng/index';

export type GameEvent =
  | { readonly type: 'TurnStarted'; readonly turn: number }
  | { readonly type: 'CardsDrawn'; readonly cards: readonly CardId[] }
  | { readonly type: 'DeckReshuffled' }
  | { readonly type: 'DamageDealt'; readonly target: EntityId; readonly amount: number }
  | { readonly type: 'BlockGained'; readonly target: EntityId; readonly amount: number };

export interface ApplyResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export function apply(state: GameState, action: Action): ApplyResult {
  switch (action.type) {
    case 'StartTurn':
      return {
        state: { ...state, phase: 'playerTurn', turn: state.turn + 1 },
        events: [{ type: 'TurnStarted', turn: state.turn + 1 }],
      };

    case 'DrawCards':
      return drawCards(state, action.count);

    case 'DealDamage':
      return dealDamage(state, action.target, action.amount);

    case 'GainBlock':
      return gainBlock(state, action.target, action.amount);

    default:
      // Exhaustiveness guard: adding an Action variant without handling it here
      // becomes a compile error.
      return assertNever(action);
  }
}

function drawCards(state: GameState, count: number): ApplyResult {
  let drawPile = state.drawPile.slice();
  let discardPile = state.discardPile.slice();
  const hand = state.hand.slice();
  let rng = state.rng;
  const drawn: CardId[] = [];
  const events: GameEvent[] = [];

  for (let i = 0; i < count; i++) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break; // nothing left to draw
      const reshuffled = shuffle(discardPile, rng);
      drawPile = reshuffled.value;
      rng = reshuffled.state;
      discardPile = [];
      events.push({ type: 'DeckReshuffled' });
    }
    const card = drawPile.shift()!;
    hand.push(card);
    drawn.push(card);
  }

  events.push({ type: 'CardsDrawn', cards: drawn });
  return {
    state: { ...state, drawPile, hand, discardPile, rng },
    events,
  };
}

function dealDamage(state: GameState, target: EntityId, amount: number): ApplyResult {
  const applyToCombatant = <T extends GameState['player']>(c: T): T => {
    if (c.id !== target) return c;
    const absorbed = Math.min(c.block, amount);
    const remaining = amount - absorbed;
    return { ...c, block: c.block - absorbed, hp: Math.max(0, c.hp - remaining) };
  };

  return {
    state: {
      ...state,
      player: applyToCombatant(state.player),
      enemies: state.enemies.map(applyToCombatant),
    },
    events: [{ type: 'DamageDealt', target, amount }],
  };
}

function gainBlock(state: GameState, target: EntityId, amount: number): ApplyResult {
  const addBlock = <T extends GameState['player']>(c: T): T =>
    c.id === target ? { ...c, block: c.block + amount } : c;

  return {
    state: {
      ...state,
      player: addBlock(state.player),
      enemies: state.enemies.map(addBlock),
    },
    events: [{ type: 'BlockGained', target, amount }],
  };
}

/**
 * Fold a whole sequence of actions into a final state + accumulated events.
 * `state = applyAll(initialState(seed), log)` is the event-sourcing core.
 */
export function applyAll(
  state: GameState,
  actions: readonly Action[],
): ApplyResult {
  let current = state;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const result = apply(current, action);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

function assertNever(x: never): never {
  throw new Error(`Unhandled action: ${JSON.stringify(x)}`);
}
