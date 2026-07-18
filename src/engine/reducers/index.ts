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
 * and reacts to `events`; it never mutates either. Every event carries enough to
 * render a game-log line (see docs/atomic-actions.md).
 */
import type { CardId, CloudType, EntityId, ScaleMetric } from '@shared/index';
import { entityId } from '@shared/index';
import type { Combatant, GameState, MinionState } from '@engine/state/index';
import type { Action } from '@engine/actions/index';
import { nextInt, shuffle } from '@engine/rng/index';

export type GameEvent =
  | { readonly type: 'TurnStarted'; readonly turn: number }
  | { readonly type: 'TurnEnded'; readonly turn: number }
  | { readonly type: 'CardsDrawn'; readonly cards: readonly CardId[] }
  | { readonly type: 'CardsDiscarded'; readonly cards: readonly CardId[] }
  | { readonly type: 'DeckReshuffled' }
  // `unblocked` is the portion that got past block+shield — what triggers like
  // Rot Away ("whenever you deal unblocked damage") key off.
  | { readonly type: 'DamageDealt'; readonly target: EntityId; readonly amount: number; readonly unblocked: number }
  | { readonly type: 'BlockGained'; readonly target: EntityId; readonly amount: number }
  | { readonly type: 'BlockCleared'; readonly target: EntityId }
  | { readonly type: 'ShieldGained'; readonly target: EntityId; readonly amount: number }
  | { readonly type: 'Healed'; readonly target: EntityId; readonly amount: number }
  | { readonly type: 'EnergyGained'; readonly target: EntityId; readonly amount: number }
  | { readonly type: 'PoisonChanged'; readonly target: EntityId; readonly amount: number }
  | { readonly type: 'PowerGained'; readonly target: EntityId; readonly amount: number }
  | { readonly type: 'BraveryGained'; readonly target: EntityId; readonly amount: number }
  | { readonly type: 'CloudsCreated'; readonly target: EntityId; readonly cloudType: CloudType; readonly count: number }
  // `removed` lists the actual cloud types taken away — Static keys off Lightning.
  | { readonly type: 'CloudsRemoved'; readonly target: EntityId; readonly count: number; readonly removed: readonly CloudType[] }
  | { readonly type: 'MinionSummoned'; readonly owner: EntityId; readonly cardId: CardId }
  | { readonly type: 'MinionDiscarded'; readonly owner: EntityId; readonly count: number }
  | { readonly type: 'PersistentAdded'; readonly target: EntityId; readonly cardId: CardId };

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

    case 'EndTurn':
      return {
        state: { ...state, phase: 'enemyTurn' },
        events: [{ type: 'TurnEnded', turn: state.turn }],
      };

    case 'ClearBlock':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, block: 0 })),
        events: [{ type: 'BlockCleared', target: action.target }],
      };

    case 'DiscardCards':
      return discardCards(state, action.count);

    case 'DealDamageToRandomEnemy':
      return dealDamageToRandomEnemy(state, action.amount);

    case 'DealDamageScaled':
      return dealDamage(state, action.target, action.multiplier * metricValue(state, action.self, action.per));

    case 'AddPersistent':
      return {
        state: mapCombatant(state, action.target, (c) => ({
          ...c,
          persistents: [...c.persistents, action.cardId],
        })),
        events: [{ type: 'PersistentAdded', target: action.target, cardId: action.cardId }],
      };

    case 'DrawCards':
      return drawCards(state, action.count);

    case 'DealDamage':
      return dealDamage(state, action.target, action.amount);

    case 'GainBlock':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, block: c.block + action.amount })),
        events: [{ type: 'BlockGained', target: action.target, amount: action.amount }],
      };

    case 'GainShield':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, shield: c.shield + action.amount })),
        events: [{ type: 'ShieldGained', target: action.target, amount: action.amount }],
      };

    case 'Heal':
      return {
        state: mapCombatant(state, action.target, (c) => ({
          ...c,
          hp: Math.min(c.maxHp, c.hp + action.amount),
        })),
        events: [{ type: 'Healed', target: action.target, amount: action.amount }],
      };

    case 'GainEnergy':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, energy: c.energy + action.amount })),
        events: [{ type: 'EnergyGained', target: action.target, amount: action.amount }],
      };

    case 'GainPoison':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, poison: c.poison + action.amount })),
        events: [{ type: 'PoisonChanged', target: action.target, amount: action.amount }],
      };

    case 'GainPower':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, power: c.power + action.amount })),
        events: [{ type: 'PowerGained', target: action.target, amount: action.amount }],
      };

    case 'GainBravery':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, bravery: c.bravery + action.amount })),
        events: [{ type: 'BraveryGained', target: action.target, amount: action.amount }],
      };

    case 'CreateClouds':
      return createClouds(state, action.target, action.cloudType, action.count);

    case 'RemoveClouds':
      return removeClouds(state, action.target, action.count);

    case 'Venom':
      return venom(state, action.self, action.target);

    case 'Drink':
      return drink(state, action.self);

    case 'SummonMinion':
      return summonMinion(state, action.owner, action.cardId);

    case 'DiscardMinion':
      return discardMinion(state, action.owner, action.count);

    default:
      // Exhaustiveness guard: adding an Action variant without handling it here
      // becomes a compile error.
      return assertNever(action);
  }
}

/** Apply `fn` to whichever combatant (player or an enemy) matches `id`. */
function mapCombatant(
  state: GameState,
  id: EntityId,
  fn: (c: Combatant) => Combatant,
): GameState {
  return {
    ...state,
    player: state.player.id === id ? fn(state.player) : state.player,
    enemies: state.enemies.map((e) => (e.id === id ? fn(e) : e)),
  };
}

function findCombatant(state: GameState, id: EntityId): Combatant | undefined {
  if (state.player.id === id) return state.player;
  return state.enemies.find((e) => e.id === id);
}

/**
 * Measure a scaling metric against a combatant — "your energy", "unique clouds",
 * "minions in play". Used by DealDamageScaled and by scaled trigger effects.
 */
export function metricValue(state: GameState, id: EntityId, metric: ScaleMetric): number {
  const c = findCombatant(state, id);
  if (!c) return 0;
  switch (metric) {
    case 'energy':
      return c.energy;
    case 'poison':
      return c.poison;
    case 'block':
      return c.block;
    case 'shield':
      return c.shield;
    case 'power':
      return c.power;
    case 'bravery':
      return c.bravery;
    case 'clouds':
      return c.clouds.length;
    case 'uniqueClouds':
      return new Set(c.clouds).size;
    case 'minions':
      return c.minions.length;
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

/** Damage soaks block first, then shield, then hits hp. */
function dealDamage(state: GameState, target: EntityId, amount: number): ApplyResult {
  const current = findCombatant(state, target);
  const fromBlock = Math.min(current?.block ?? 0, amount);
  const fromShield = Math.min(current?.shield ?? 0, amount - fromBlock);
  const unblocked = amount - fromBlock - fromShield;

  const hit = (c: Combatant): Combatant => ({
    ...c,
    block: c.block - Math.min(c.block, amount),
    shield: c.shield - Math.min(c.shield, amount - Math.min(c.block, amount)),
    hp: Math.max(0, c.hp - unblocked),
  });

  return {
    state: mapCombatant(state, target, hit),
    events: [{ type: 'DamageDealt', target, amount, unblocked }],
  };
}

function dealDamageToRandomEnemy(state: GameState, amount: number): ApplyResult {
  const living = state.enemies.filter((e) => e.hp > 0);
  if (living.length === 0) return { state, events: [] };
  const draw = nextInt(state.rng, 0, living.length - 1);
  const target = living[draw.value]!.id;
  const result = dealDamage({ ...state, rng: draw.state }, target, amount);
  return result;
}

function discardCards(state: GameState, count: number): ApplyResult {
  const n = Math.min(Math.max(0, count), state.hand.length);
  if (n === 0) return { state, events: [{ type: 'CardsDiscarded', cards: [] }] };
  const discarded = state.hand.slice(state.hand.length - n);
  return {
    state: {
      ...state,
      hand: state.hand.slice(0, state.hand.length - n),
      discardPile: [...state.discardPile, ...discarded],
    },
    events: [{ type: 'CardsDiscarded', cards: discarded }],
  };
}

function createClouds(
  state: GameState,
  target: EntityId,
  cloudType: CloudType,
  count: number,
): ApplyResult {
  const added = Array.from({ length: Math.max(0, count) }, () => cloudType);
  return {
    state: mapCombatant(state, target, (c) => ({ ...c, clouds: [...c.clouds, ...added] })),
    events: [{ type: 'CloudsCreated', target, cloudType, count: added.length }],
  };
}

function removeClouds(state: GameState, target: EntityId, count: number): ApplyResult {
  const current = findCombatant(state, target);
  const keep = current ? Math.max(0, current.clouds.length - count) : 0;
  const removed = current ? current.clouds.slice(keep) : [];
  return {
    state: mapCombatant(state, target, (c) => ({ ...c, clouds: c.clouds.slice(0, keep) })),
    events: [{ type: 'CloudsRemoved', target, count: removed.length, removed }],
  };
}

function venom(state: GameState, self: EntityId, target: EntityId): ApplyResult {
  const caster = findCombatant(state, self);
  const amount = caster?.poison ?? 0;
  const damaged = dealDamage(state, target, amount);
  return {
    state: mapCombatant(damaged.state, self, (c) => ({ ...c, poison: 0 })),
    events: [...damaged.events, { type: 'PoisonChanged', target: self, amount: -amount }],
  };
}

function drink(state: GameState, self: EntityId): ApplyResult {
  const caster = findCombatant(state, self);
  const amount = caster?.poison ?? 0;
  return {
    state: mapCombatant(state, self, (c) => ({ ...c, block: c.block + amount, poison: 0 })),
    events: [
      { type: 'BlockGained', target: self, amount },
      { type: 'PoisonChanged', target: self, amount: -amount },
    ],
  };
}

function summonMinion(state: GameState, owner: EntityId, cardId: CardId): ApplyResult {
  const minion: MinionState = { id: entityId(`minion-${state.idSeq}`), cardId };
  return {
    state: {
      ...mapCombatant(state, owner, (c) => ({ ...c, minions: [...c.minions, minion] })),
      idSeq: state.idSeq + 1,
    },
    events: [{ type: 'MinionSummoned', owner, cardId }],
  };
}

function discardMinion(state: GameState, owner: EntityId, count: number): ApplyResult {
  const current = findCombatant(state, owner);
  const removed = current ? Math.min(current.minions.length, Math.max(0, count)) : 0;
  return {
    state: mapCombatant(state, owner, (c) => ({
      ...c,
      minions: c.minions.slice(0, Math.max(0, c.minions.length - count)),
    })),
    events: [{ type: 'MinionDiscarded', owner, count: removed }],
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
