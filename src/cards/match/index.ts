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
import {
  apply,
  opponentsOf,
  type Action,
  type Combatant,
  type GameEvent,
  type GameState,
  type MinionState,
} from '@engine/index';
import type { EntityId } from '@shared/index';
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

/** Find any combatant (player or an enemy) by id. */
function combatantOf(state: GameState, id: EntityId): Combatant | undefined {
  return state.player.id === id ? state.player : state.enemies.find((e) => e.id === id);
}

/** The ordered cloud triggers for `actor`'s current clouds (defaults to the player). */
export function cloudEffects(state: GameState, actorId: EntityId = state.player.id): Action[] {
  const actor = combatantOf(state, actorId);
  if (!actor) return [];
  // Persistents (Winter's snow bonus) are the player's; the enemy has none today.
  const snowBonus =
    actorId === state.player.id
      ? activePersistents(state).reduce((n, p) => n + (p.snowHealBonus ?? 0), 0)
      : 0;
  const actions: Action[] = [];
  for (const cloud of actor.clouds) {
    switch (cloud) {
      case 'lightning':
        actions.push({ type: 'GainEnergy', target: actorId, amount: 1 });
        break;
      case 'snow':
        actions.push({ type: 'Heal', target: actorId, amount: 1 + snowBonus });
        break;
      case 'storm':
        actions.push({ type: 'DealDamageToRandomEnemy', self: actorId, amount: 1 });
        break;
      case 'fog':
        actions.push({ type: 'DrawCards', owner: actorId, count: 1 });
        break;
    }
  }
  return actions;
}

/** A minion's on-play effects, minus summoning itself again. */
function minionReplayActions(state: GameState, actorId: EntityId, minion: MinionState): Action[] {
  const card = getCard(minion.cardId);
  if (!card) return [];
  const compiled = compile(card.text);
  if (!compiled.ok) return [];
  const ctx: PlayContext = {
    self: actorId,
    target: opponentsOf(state, actorId)[0]?.id ?? actorId,
    sourceCard: minion.cardId,
  };
  return compiled.value.map((produce) => produce(ctx)).filter((a) => a.type !== 'SummonMinion');
}

/**
 * The shared start-of-turn cascade for ANY actor: clear temporary block, reset
 * energy to base (if asked), fire every one of that actor's clouds, run the
 * player's start-of-turn persistents, replay that actor's minions, then draw.
 * Does NOT touch `phase` or the turn counter — callers own those — so it works
 * for both the player (`startTurn`) and the enemy (`beginEnemyTurn`), which is
 * what makes a real card-playing Cloud opponent fire its clouds like the player.
 */
export function runTurnCascade(
  state: GameState,
  actorId: EntityId,
  opts: { resetEnergyTo?: number; draw?: number } = {},
): RunResult {
  const isPlayer = actorId === state.player.id;
  let current = state;
  const events: GameEvent[] = [];
  const run = (actions: readonly Action[]) => {
    const result = runWithTriggers(current, actions);
    current = result.state;
    events.push(...result.events);
  };

  run([{ type: 'ClearBlock', target: actorId }]);
  // Design: you start each turn with a base energy (usually 1); Lightning clouds
  // then add on top. Reset happens before clouds so "start with >3 energy" checks
  // (Summer) see the post-Lightning total.
  if (opts.resetEnergyTo !== undefined) run([{ type: 'SetEnergy', target: actorId, amount: opts.resetEnergyTo }]);
  run(cloudEffects(current, actorId));
  // Persistents are modelled as the player's (`activePersistents` reads the player).
  if (isPlayer) run(activePersistents(current).flatMap((p) => (p.onStartTurn ? p.onStartTurn(current) : [])));
  const actor = combatantOf(current, actorId);
  if (actor) for (const minion of actor.minions.slice()) run(minionReplayActions(current, actorId, minion));

  const draw = opts.draw ?? 0;
  if (draw > 0) run([{ type: 'DrawCards', owner: actorId, count: draw }]);

  return { state: current, events };
}

/**
 * Start the player's turn: advance the counter + phase (the `StartTurn` action),
 * then run the shared cascade (clear block, energy, clouds, persistents, minions,
 * draw 1 by default).
 */
export function startTurn(
  state: GameState,
  opts: { draw?: number; actorId?: EntityId; resetEnergyTo?: number } = {},
): RunResult {
  const actorId = opts.actorId ?? state.player.id;
  const started = runWithTriggers(state, [{ type: 'StartTurn' }]);
  const cascade = runTurnCascade(started.state, actorId, {
    ...(opts.resetEnergyTo !== undefined ? { resetEnergyTo: opts.resetEnergyTo } : {}),
    draw: opts.draw ?? 1,
  });
  return { state: cascade.state, events: [...started.events, ...cascade.events] };
}

/**
 * End the player's turn: run end-of-turn persistents, Fog clouds force a discard
 * (unless Fall suppresses it), then the turn ends. (Enemy turns / full turn
 * structure are Phase 2.)
 */
export function endTurn(state: GameState, opts: { actorId?: EntityId } = {}): RunResult {
  const actorId = opts.actorId ?? state.player.id;
  const isPlayer = actorId === state.player.id;
  let current = state;
  const events: GameEvent[] = [];
  const run = (actions: readonly Action[]) => {
    const result = runWithTriggers(current, actions);
    current = result.state;
    events.push(...result.events);
  };

  if (isPlayer) run(activePersistents(current).flatMap((b) => (b.onEndTurn ? b.onEndTurn(current) : [])));

  const autumn = isPlayer && activePersistents(current).some((b) => b.suppressFogDiscard);
  const actor = combatantOf(current, actorId);
  const fog = actor ? actor.clouds.filter((c) => c === 'fog').length : 0;
  if (!autumn && fog > 0) run([{ type: 'DiscardCards', owner: actorId, count: fog }]);

  run([{ type: 'EndTurn' }]);
  return { state: current, events };
}
