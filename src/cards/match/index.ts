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
  type PendingChoice,
} from '@engine/index';
import type { EntityId } from '@shared/index';
import type { PlayContext } from '@cards/dsl/resolver';
import { compile } from '@cards/compile';
import { getCard, type CardDef } from '@cards/registry';
import { activePersistents } from '@cards/match/persistents';
import { moltTriggers } from '@cards/match/molt';
import { burnTriggers } from '@cards/match/burn';
import { HAND_REFILL } from '@cards/match/content';

export interface RunResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** Safety net against a pathological trigger loop; real cascades are tiny. */
const TRIGGER_CAP = 1000;

/**
 * Follow-up actions one event owes: what the active persistents want, plus the
 * free plays from any discarded Molt cards and any Burned Unplayable cards.
 * Three sources because they live in different places — persistents react from
 * the play area, Molt and Burn cards react as they leave the hand (see
 * `molt.ts` / `burn.ts`).
 */
export function reactiveTriggers(state: GameState, event: GameEvent): Action[] {
  return [
    ...activePersistents(state).flatMap((p) => (p.onEvent ? p.onEvent(state, event) : [])),
    ...moltTriggers(state, event),
    ...burnTriggers(state, event),
  ];
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

/**
 * "Run out of cards": the next refill draw owed, or null. A combatant whose
 * hand is empty mid-battle draws `HAND_REFILL` (+ their `bonusRefillDraw` —
 * Brain in a Jar) new cards. A design rule, so it lives here beside the other
 * orchestration, not in the engine. Gated to the battle phases — setup and the
 * mulligan legitimately pass through empty hands — and to combatants who still
 * have cards *somewhere*, so a truly exhausted deck can't loop the refill.
 */
function refillDraw(state: GameState): Action | null {
  if (state.phase !== 'playerTurn' && state.phase !== 'enemyTurn') return null;
  const emptyHanded = [state.player, ...state.enemies].find(
    (c) => c.hp > 0 && c.hand.length === 0 && c.drawPile.length + c.discardPile.length > 0,
  );
  if (!emptyHanded) return null;
  return { type: 'DrawCards', owner: emptyHanded.id, count: HAND_REFILL + emptyHanded.bonusRefillDraw };
}

/**
 * Settle run-out-of-cards refills. Called at STEP boundaries — after a card
 * fully resolves, after end-of-turn discards, at the end of the start-of-turn
 * cascade — and deliberately NOT inside `applyWithTriggers`: a mid-card refill
 * could reshuffle the very card being played out of the discard pile before
 * its own "shuffle this into your draw pile" resolves, and would double-fill
 * hands for cards that empty-then-redraw (Refresh, Exoskeleton). "The moment
 * your hand hits zero" means as soon as whatever emptied it has finished.
 *
 * One refill at a time, so each recheck sees the previous refill's whole
 * cascade. Terminates because a refill always draws at least one card into the
 * empty hand (the piles were non-empty); the guard backstops a pathological
 * trigger that re-empties hands.
 */
export function settleHandRefills(state: GameState): RunResult {
  let current = state;
  const events: GameEvent[] = [];
  let guard = 0;
  for (let next = refillDraw(current); next && guard++ < 8; next = refillDraw(current)) {
    const r = applyWithTriggers(current, next);
    current = r.state;
    events.push(...r.events);
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

/**
 * Would applying `action` interactively need the owner to pick first? Only
 * when there's a genuine choice: a counted selection without chosen
 * `uids`/`indices`, with MORE eligible things than the count — a whole-pool
 * effect (discard your hand, remove all clouds, burn every Unplayable) or a
 * count that covers everything eligible has exactly one outcome and
 * auto-resolves. One entry per selecting action; the random/'all' variants
 * (RemoveRandomClouds, DiscardAllMinions, …) are separate types and never ask.
 */
function choiceFor(
  state: GameState,
  action: Action,
): Pick<PendingChoice, 'kind' | 'owner' | 'count'> | null {
  const pick = (
    kind: PendingChoice['kind'],
    owner: GameState['player']['id'],
    count: number,
    eligible: number,
  ): Pick<PendingChoice, 'kind' | 'owner' | 'count'> | null => {
    const n = Math.min(Math.max(0, count), eligible);
    return n > 0 && eligible > n ? { kind, owner, count: n } : null;
  };
  switch (action.type) {
    case 'DiscardCards': {
      if (action.uids) return null;
      const owner = action.owner ?? state.player.id;
      return pick('discard', owner, action.count, combatantOf(state, owner)?.hand.length ?? 0);
    }
    case 'BurnCards': {
      if (action.uids || action.count === undefined) return null;
      const c = combatantOf(state, action.owner);
      return pick('burn', action.owner, action.count, c?.hand.filter((i) => i.unplayable).length ?? 0);
    }
    case 'RemoveClouds': {
      if (action.indices) return null;
      return pick('cloud', action.target, action.count, combatantOf(state, action.target)?.clouds.length ?? 0);
    }
    case 'DiscardMinion': {
      if (action.indices) return null;
      return pick('minion', action.owner, action.count, combatantOf(state, action.owner)?.minions.length ?? 0);
    }
    case 'MoveDiscardToDrawPile': {
      if (action.uids) return null;
      return pick('recover', action.owner, action.count, combatantOf(state, action.owner)?.discardPile.length ?? 0);
    }
    default:
      return null;
  }
}

/**
 * Run `actions` in order; when `interactive`, PAUSE on the first one that needs
 * a card pick — the remaining actions are suspended in `pending.queued` (plain
 * data, so the pause is serializable) and resume via `resolvePendingChoice`
 * (`battle.ts`). Non-interactive callers (the AI, tests, the whole trigger
 * cascade) never pause: a discard fired mid-cascade by a Molt free play still
 * auto-resolves with the default selection.
 */
export function runOrPause(state: GameState, actions: readonly Action[], interactive: boolean): RunResult {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    if (interactive) {
      const choice = choiceFor(current, action);
      if (choice) {
        const paused = applyWithTriggers(current, {
          type: 'SetPendingChoice',
          pending: { ...choice, queued: actions.slice(i) },
        });
        return { state: paused.state, events: [...events, ...paused.events] };
      }
    }
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

  run([{ type: 'ClearBlock', target: actorId }, { type: 'ClearTurnCounters', target: actorId }]);
  // Design: you start each turn with a base energy (usually 1); Lightning clouds
  // then add on top. Reset happens before clouds so "start with >3 energy" checks
  // (Summer) see the post-Lightning total.
  if (opts.resetEnergyTo !== undefined) run([{ type: 'SetEnergy', target: actorId, amount: opts.resetEnergyTo }]);
  // Solar Power: clouds fire a second time this turn, then the flag is spent.
  // Read before the first firing, since the actions below rewrite the combatant.
  const playsTwice = combatantOf(current, actorId)?.cloudsPlayTwice ?? false;
  run(cloudEffects(current, actorId));
  if (playsTwice) {
    run(cloudEffects(current, actorId));
    run([{ type: 'SetCloudsPlayTwice', target: actorId, value: false }]);
  }
  // Persistents are modelled as the player's (`activePersistents` reads the player).
  if (isPlayer) run(activePersistents(current).flatMap((p) => (p.onStartTurn ? p.onStartTurn(current) : [])));
  const actor = combatantOf(current, actorId);
  if (actor) {
    // Protect the Drinks replays each minion extra times. The bonus is the
    // player's (persistents are), so the enemy replays once as before.
    const extra = isPlayer
      ? activePersistents(current).reduce((n, p) => n + (p.minionReplayBonus ?? 0), 0)
      : 0;
    for (const minion of actor.minions.slice()) {
      for (let i = 0; i < 1 + extra; i++) {
        // Announce the replay first, so "when a minion is replayed" (Juggle)
        // fires for each one — including the extra passes.
        run([{ type: 'NoteMinionReplayed', owner: actorId }]);
        run(minionReplayActions(current, actorId, minion));
      }
    }
  }

  const draw = opts.draw ?? 0;
  if (draw > 0) run([{ type: 'DrawCards', owner: actorId, count: draw }]);

  // A turn must not begin with an empty hand while cards remain to draw.
  const settled = settleHandRefills(current);
  current = settled.state;
  events.push(...settled.events);

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
export function endTurn(
  state: GameState,
  opts: { actorId?: EntityId; interactive?: boolean } = {},
): RunResult {
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

  // The Fog penalty is a hand discard, so an interactive player picks the
  // card(s) — the pause suspends EndTurn in the queue; refills settle when the
  // choice resolves (`resolvePendingChoice`).
  const tail: Action[] = [];
  if (!autumn && fog > 0) tail.push({ type: 'DiscardCards', owner: actorId, count: fog });
  tail.push({ type: 'EndTurn' });
  const ran = runOrPause(current, tail, opts.interactive === true);
  current = ran.state;
  events.push(...ran.events);
  if (current.pending) return { state: current, events };

  // End-of-turn discards (Fog, Exoskeleton) may have emptied a hand.
  const settled = settleHandRefills(current);
  current = settled.state;
  events.push(...settled.events);

  return { state: current, events };
}
