/**
 * The turn & trigger orchestration.
 *
 * The engine reducer is deliberately *atomic and trigger-free* — one action, one
 * mutation. But real play is a cascade: playing a card creates a cloud, which a
 * persistent turns into damage, which another persistent turns into poison; and
 * the start of a turn fires every cloud and replays every minion. Resolving that
 * needs BOTH the reducer AND the card DSL (minions replay their compiled text),
 * so it lives here in the `cards` layer — the only layer that has both.
 *
 * Determinism is preserved: triggers are a pure function of state + the event
 * that fired them, and all randomness still flows through engine actions
 * (`state.rng`). Replaying the primary actions reproduces every triggered effect,
 * so the action log stays the source of truth.
 */
import { apply, type Action, type GameEvent, type GameState, type MinionState } from '@engine/index';
import type { PlayContext } from '@cards/dsl/resolver';
import { compile } from '@cards/compile';
import { getCard, type CardDef } from '@cards/registry';
import { activePersistents } from '@cards/match/persistents';

export interface RunResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** Safety net against a pathological trigger loop; real cascades are tiny. */
const TRIGGER_CAP = 1000;

/** Follow-up actions the active persistents want in response to one event. */
export function reactiveTriggers(state: GameState, event: GameEvent): Action[] {
  return activePersistents(state).flatMap((p) => (p.onEvent ? p.onEvent(state, event) : []));
}

/** Apply one action, then resolve the reactive-trigger cascade it sets off. */
export function applyWithTriggers(state: GameState, action: Action): RunResult {
  const base = apply(state, action);
  let current = base.state;
  const events: GameEvent[] = [...base.events];

  const queue: GameEvent[] = [...base.events];
  let guard = 0;
  while (queue.length > 0 && guard++ < TRIGGER_CAP) {
    const event = queue.shift()!;
    for (const followup of reactiveTriggers(current, event)) {
      const result = apply(current, followup);
      current = result.state;
      events.push(...result.events);
      queue.push(...result.events);
    }
  }
  return { state: current, events };
}

/** Apply a sequence of actions, resolving triggers between each. */
export function runWithTriggers(state: GameState, actions: readonly Action[]): RunResult {
  let current = state;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const result = applyWithTriggers(current, action);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** Play a card: compile its text, bind the play context, resolve with triggers. */
export function playCard(state: GameState, card: CardDef, ctx: PlayContext): RunResult {
  const compiled = compile(card.text);
  if (!compiled.ok) return { state, events: [] };
  return runWithTriggers(state, compiled.value.map((produce) => produce(ctx)));
}

/** The ordered cloud triggers for the player's current clouds. */
export function cloudEffects(state: GameState): Action[] {
  const self = state.player.id;
  const snowBonus = activePersistents(state).reduce((n, p) => n + (p.snowHealBonus ?? 0), 0);
  const actions: Action[] = [];
  for (const cloud of state.player.clouds) {
    switch (cloud) {
      case 'lightning':
        actions.push({ type: 'GainEnergy', target: self, amount: 1 });
        break;
      case 'snow':
        actions.push({ type: 'Heal', target: self, amount: 1 + snowBonus });
        break;
      case 'storm':
        actions.push({ type: 'DealDamageToRandomEnemy', amount: 1 });
        break;
      case 'fog':
        actions.push({ type: 'DrawCards', count: 1 });
        break;
    }
  }
  return actions;
}

/** A minion's on-play effects, minus summoning itself again. */
function minionReplayActions(state: GameState, minion: MinionState): Action[] {
  const card = getCard(minion.cardId);
  if (!card) return [];
  const compiled = compile(card.text);
  if (!compiled.ok) return [];
  const ctx: PlayContext = {
    self: state.player.id,
    target: state.enemies[0]?.id ?? state.player.id,
    sourceCard: minion.cardId,
  };
  return compiled.value.map((produce) => produce(ctx)).filter((a) => a.type !== 'SummonMinion');
}

/**
 * Start the player's turn: advance the counter, clear temporary block, fire every
 * cloud, run start-of-turn persistents, replay minions, then draw. Each step
 * resolves its own triggers before the next runs.
 */
export function startTurn(state: GameState, opts: { draw?: number } = {}): RunResult {
  let current = state;
  const events: GameEvent[] = [];
  const run = (actions: readonly Action[]) => {
    const result = runWithTriggers(current, actions);
    current = result.state;
    events.push(...result.events);
  };

  run([{ type: 'StartTurn' }]);
  run([{ type: 'ClearBlock', target: current.player.id }]);
  run(cloudEffects(current));
  run(activePersistents(current).flatMap((p) => (p.onStartTurn ? p.onStartTurn(current) : [])));
  for (const minion of current.player.minions.slice()) run(minionReplayActions(current, minion));

  const draw = opts.draw ?? 1;
  if (draw > 0) run([{ type: 'DrawCards', count: draw }]);

  return { state: current, events };
}

/**
 * End the player's turn: run end-of-turn persistents, Fog clouds force a discard
 * (unless Autumn suppresses it), then the turn ends. (Enemy turns / full turn
 * structure are Phase 2.)
 */
export function endTurn(state: GameState): RunResult {
  let current = state;
  const events: GameEvent[] = [];
  const run = (actions: readonly Action[]) => {
    const result = runWithTriggers(current, actions);
    current = result.state;
    events.push(...result.events);
  };

  run(activePersistents(current).flatMap((b) => (b.onEndTurn ? b.onEndTurn(current) : [])));

  const autumn = activePersistents(current).some((b) => b.suppressFogDiscard);
  const fog = current.player.clouds.filter((c) => c === 'fog').length;
  if (!autumn && fog > 0) run([{ type: 'DiscardCards', count: fog }]);

  run([{ type: 'EndTurn' }]);
  return { state: current, events };
}
