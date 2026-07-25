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
import type { Combatant, GameState, MinionState, Phase } from '@engine/state/index';
import type { Action } from '@engine/actions/index';
import { nextInt, shuffle } from '@engine/rng/index';

/** Why cards left a hand — see the `CardsDiscarded` event below. */
export type DiscardReason = 'discard' | 'play' | 'setup';

export type GameEvent =
  | { readonly type: 'TurnStarted'; readonly turn: number }
  | { readonly type: 'TurnEnded'; readonly turn: number }
  | { readonly type: 'PhaseChanged'; readonly phase: Phase }
  | { readonly type: 'CardsDrawn'; readonly owner: EntityId; readonly cards: readonly CardId[] }
  /**
   * Cards left a hand for the discard pile. Only `'discard'` is a discard in the
   * game's sense — the Fog penalty, "discard 2 cards" — and only it may set off
   * discard triggers like the Crab's Claw. `'play'` is a card moving to the pile
   * as it is played (firing on that would play every Claw card twice), and
   * `'setup'` is the opening mulligan, which happens before the battle begins.
   */
  | {
      readonly type: 'CardsDiscarded';
      readonly owner: EntityId;
      readonly cards: readonly CardId[];
      readonly reason: DiscardReason;
    }
  | { readonly type: 'TurnCountersCleared'; readonly target: EntityId }
  | { readonly type: 'DeckReshuffled'; readonly owner: EntityId }
  | { readonly type: 'EnergySet'; readonly target: EntityId; readonly amount: number }
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
  | { readonly type: 'MaxCloudsIncreased'; readonly target: EntityId; readonly amount: number }
  | { readonly type: 'CloudsPlayTwiceSet'; readonly target: EntityId; readonly value: boolean }
  | { readonly type: 'VenomRetainsSet'; readonly target: EntityId; readonly value: boolean }
  | { readonly type: 'CardPlayed'; readonly owner: EntityId }
  | { readonly type: 'MinionReplayed'; readonly owner: EntityId }
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

    case 'SetPhase':
      return { state: { ...state, phase: action.phase }, events: [{ type: 'PhaseChanged', phase: action.phase }] };

    case 'ClearBlock':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, block: 0 })),
        events: [{ type: 'BlockCleared', target: action.target }],
      };

    case 'ClearTurnCounters':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, discardedThisTurn: 0, cardsPlayedThisTurn: 0 })),
        events: [{ type: 'TurnCountersCleared', target: action.target }],
      };

    case 'DiscardCards':
      return discardCards(state, action.owner ?? state.player.id, action.count);

    case 'DiscardHand': {
      // Routed through discardCards so it counts, reasons, and triggers exactly
      // like any other discard — it just takes everything.
      const owner = action.owner ?? state.player.id;
      return discardCards(state, owner, findCombatant(state, owner)?.hand.length ?? 0);
    }

    case 'MoveHandCardToDiscard':
      return moveHandCardToDiscard(state, action.owner ?? state.player.id, action.index, action.reason ?? 'play');

    case 'DealDamageToRandomEnemy':
      return dealDamageToRandomEnemy(state, action.self ?? state.player.id, action.amount);

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
      return drawCards(state, action.owner ?? state.player.id, action.count);

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

    case 'SetEnergy':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, energy: Math.max(0, action.amount) })),
        events: [{ type: 'EnergySet', target: action.target, amount: Math.max(0, action.amount) }],
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

    case 'GainScaled': {
      const amount = action.multiplier * metricValue(state, action.self, action.per);
      return gainResource(state, action.target, action.resource, amount);
    }

    case 'SetVenomRetains':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, venomRetains: action.value })),
        events: [{ type: 'VenomRetainsSet', target: action.target, value: action.value }],
      };

    case 'DiscardAllMinions':
      return discardMinion(state, action.owner, findCombatant(state, action.owner)?.minions.length ?? 0);

    case 'NoteCardPlayed':
      return {
        state: mapCombatant(state, action.owner, (c) => ({ ...c, cardsPlayedThisTurn: c.cardsPlayedThisTurn + 1 })),
        events: [{ type: 'CardPlayed', owner: action.owner }],
      };

    case 'NoteMinionReplayed':
      return { state, events: [{ type: 'MinionReplayed', owner: action.owner }] };

    case 'SetCloudsPlayTwice':
      return {
        state: mapCombatant(state, action.target, (c) => ({ ...c, cloudsPlayTwice: action.value })),
        events: [{ type: 'CloudsPlayTwiceSet', target: action.target, value: action.value }],
      };

    case 'CreateRandomClouds':
      return createRandomClouds(state, action.target, action.count);

    case 'RemoveRandomClouds':
      return removeRandomClouds(state, action.target, action.count);

    case 'FillCloudSlots': {
      const c = findCombatant(state, action.target);
      const cap = action.baseCap + (c?.bonusMaxClouds ?? 0);
      return createRandomClouds(state, action.target, Math.max(0, cap - (c?.clouds.length ?? 0)));
    }

    case 'RemoveAllClouds':
      return removeClouds(state, action.target, findCombatant(state, action.target)?.clouds.length ?? 0);

    case 'IncreaseMaxClouds':
      return {
        state: mapCombatant(state, action.target, (c) => ({
          ...c,
          bonusMaxClouds: c.bonusMaxClouds + action.amount,
        })),
        events: [{ type: 'MaxCloudsIncreased', target: action.target, amount: action.amount }],
      };

    case 'RemoveCloudAt':
      return removeCloudAt(state, action.target, action.index);

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
 * The combatants on the other side of `self`. With today's one-player-vs-N model
 * that's the enemies (if `self` is the player) or just the player (if `self` is
 * an enemy) — which is exactly what "random/all opponent(s)" targeting needs
 * once the enemy plays cards through the same reducer.
 */
export function opponentsOf(state: GameState, self: EntityId): readonly Combatant[] {
  return state.player.id === self ? state.enemies : [state.player];
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
    case 'defense':
      return c.block + c.shield;
    case 'power':
      return c.power;
    case 'bravery':
      return c.bravery;
    case 'clouds':
      return c.clouds.length;
    case 'uniqueClouds':
      return new Set(c.clouds).size;
    case 'lightningClouds':
      return c.clouds.filter((x) => x === 'lightning').length;
    case 'stormClouds':
      return c.clouds.filter((x) => x === 'storm').length;
    case 'snowClouds':
      return c.clouds.filter((x) => x === 'snow').length;
    case 'fogClouds':
      return c.clouds.filter((x) => x === 'fog').length;
    case 'cardsDiscardedThisTurn':
      return c.discardedThisTurn;
    case 'cardsPlayedThisTurn':
      return c.cardsPlayedThisTurn;
    case 'minionsDiscarded':
      return c.minionsDiscarded;
    case 'minions':
      return c.minions.length;
  }
}

function drawCards(state: GameState, owner: EntityId, count: number): ApplyResult {
  const c = findCombatant(state, owner);
  if (!c) return { state, events: [{ type: 'CardsDrawn', owner, cards: [] }] };

  let drawPile = c.drawPile.slice();
  let discardPile = c.discardPile.slice();
  const hand = c.hand.slice();
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
      events.push({ type: 'DeckReshuffled', owner });
    }
    const card = drawPile.shift()!;
    hand.push(card);
    drawn.push(card);
  }

  events.push({ type: 'CardsDrawn', owner, cards: drawn });
  return {
    state: { ...mapCombatant(state, owner, (cc) => ({ ...cc, drawPile, hand, discardPile })), rng },
    events,
  };
}

/** The combatant that owns the minion with this id, if `id` is a minion. */
function minionOwner(state: GameState, id: EntityId): EntityId | undefined {
  const all = [state.player, ...state.enemies];
  const owner = all.find((c) => c.minions.some((m) => m.id === id));
  return owner?.id;
}

/**
 * Damage soaks block first, then shield, then hits hp. If the target is a MINION,
 * the minion soaks the whole attack and is discarded (the Wizard's decoy rule),
 * emitting MinionDiscarded so triggers like Consuming fire.
 */
function dealDamage(state: GameState, target: EntityId, amount: number): ApplyResult {
  const owner = minionOwner(state, target);
  if (owner) {
    return {
      state: mapCombatant(state, owner, (c) => ({ ...c, minions: c.minions.filter((m) => m.id !== target) })),
      events: [{ type: 'MinionDiscarded', owner, count: 1 }],
    };
  }

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

function dealDamageToRandomEnemy(state: GameState, self: EntityId, amount: number): ApplyResult {
  const living = opponentsOf(state, self).filter((e) => e.hp > 0);
  if (living.length === 0) return { state, events: [] };
  const draw = nextInt(state.rng, 0, living.length - 1);
  const target = living[draw.value]!.id;
  return dealDamage({ ...state, rng: draw.state }, target, amount);
}

function discardCards(state: GameState, owner: EntityId, count: number): ApplyResult {
  const c = findCombatant(state, owner);
  if (!c) return { state, events: [{ type: 'CardsDiscarded', owner, cards: [], reason: 'discard' }] };
  const n = Math.min(Math.max(0, count), c.hand.length);
  if (n === 0) return { state, events: [{ type: 'CardsDiscarded', owner, cards: [], reason: 'discard' }] };
  const discarded = c.hand.slice(c.hand.length - n);
  return {
    state: mapCombatant(state, owner, (cc) => ({
      ...cc,
      hand: cc.hand.slice(0, cc.hand.length - n),
      discardPile: [...cc.discardPile, ...discarded],
      discardedThisTurn: cc.discardedThisTurn + n,
    })),
    events: [{ type: 'CardsDiscarded', owner, cards: discarded, reason: 'discard' }],
  };
}

function moveHandCardToDiscard(
  state: GameState,
  owner: EntityId,
  index: number,
  reason: 'play' | 'setup',
): ApplyResult {
  const c = findCombatant(state, owner);
  if (!c || index < 0 || index >= c.hand.length) {
    return { state, events: [{ type: 'CardsDiscarded', owner, cards: [], reason }] };
  }
  const card = c.hand[index]!;
  return {
    state: mapCombatant(state, owner, (cc) => ({
      ...cc,
      hand: cc.hand.filter((_, i) => i !== index),
      discardPile: [...cc.discardPile, card],
      // Deliberately not counted in `discardedThisTurn`: a card being played or
      // mulliganed is not discarded. Counting the play would also let "for each
      // card discarded this turn" read the very card that is asking.
    })),
    events: [{ type: 'CardsDiscarded', owner, cards: [card], reason }],
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

/** Add `amount` of one resource, with the same event each dedicated action emits. */
function gainResource(
  state: GameState,
  target: EntityId,
  resource: 'block' | 'shield' | 'energy' | 'power' | 'bravery' | 'poison',
  amount: number,
): ApplyResult {
  const next = mapCombatant(state, target, (c) => ({ ...c, [resource]: c[resource] + amount }));
  const event: GameEvent =
    resource === 'block'
      ? { type: 'BlockGained', target, amount }
      : resource === 'shield'
        ? { type: 'ShieldGained', target, amount }
        : resource === 'energy'
          ? { type: 'EnergyGained', target, amount }
          : resource === 'power'
            ? { type: 'PowerGained', target, amount }
            : resource === 'bravery'
              ? { type: 'BraveryGained', target, amount }
              : { type: 'PoisonChanged', target, amount };
  return { state: next, events: [event] };
}

const CLOUD_KINDS: readonly CloudType[] = ['lightning', 'storm', 'snow', 'fog'];

/**
 * Create `count` clouds of random types, threading the RNG through each draw so
 * the whole thing stays a pure function of (state, action).
 *
 * Emits one `CloudsCreated` per cloud rather than one batched event, because
 * "whenever you create a cloud" (Spring) fires per cloud and the types differ.
 */
function createRandomClouds(state: GameState, target: EntityId, count: number): ApplyResult {
  let rng = state.rng;
  const added: CloudType[] = [];
  for (let i = 0; i < Math.max(0, count); i++) {
    const pick = nextInt(rng, 0, CLOUD_KINDS.length - 1);
    rng = pick.state;
    added.push(CLOUD_KINDS[pick.value]!);
  }
  const next = mapCombatant(state, target, (c) => ({ ...c, clouds: [...c.clouds, ...added] }));
  return {
    state: { ...next, rng },
    events: added.map((cloudType) => ({ type: 'CloudsCreated', target, cloudType, count: 1 })),
  };
}

/** Remove `count` clouds chosen at random (Wild Wind), newest-first being wrong here. */
function removeRandomClouds(state: GameState, target: EntityId, count: number): ApplyResult {
  const current = findCombatant(state, target);
  if (!current) return { state, events: [{ type: 'CloudsRemoved', target, count: 0, removed: [] }] };
  let rng = state.rng;
  let clouds = current.clouds.slice();
  const removed: CloudType[] = [];
  for (let i = 0; i < Math.max(0, count) && clouds.length > 0; i++) {
    const pick = nextInt(rng, 0, clouds.length - 1);
    rng = pick.state;
    removed.push(clouds[pick.value]!);
    clouds = clouds.filter((_, j) => j !== pick.value);
  }
  const next = mapCombatant(state, target, (c) => ({ ...c, clouds }));
  return { state: { ...next, rng }, events: [{ type: 'CloudsRemoved', target, count: removed.length, removed }] };
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

function removeCloudAt(state: GameState, target: EntityId, index: number): ApplyResult {
  const current = findCombatant(state, target);
  if (!current || index < 0 || index >= current.clouds.length) {
    return { state, events: [{ type: 'CloudsRemoved', target, count: 0, removed: [] }] };
  }
  const removed = [current.clouds[index]!];
  return {
    state: mapCombatant(state, target, (c) => ({ ...c, clouds: c.clouds.filter((_, i) => i !== index) })),
    events: [{ type: 'CloudsRemoved', target, count: 1, removed }],
  };
}

function venom(state: GameState, self: EntityId, target: EntityId): ApplyResult {
  const caster = findCombatant(state, self);
  const amount = caster?.poison ?? 0;
  const damaged = dealDamage(state, target, amount);
  // Sacrifice / Sticky Poison let one Venom keep its Poison. The flag is spent
  // either way, so it arms exactly one Venom.
  const retains = caster?.venomRetains ?? false;
  return {
    state: mapCombatant(damaged.state, self, (c) => ({
      ...c,
      poison: retains ? c.poison : 0,
      venomRetains: false,
    })),
    events: retains
      ? damaged.events
      : [...damaged.events, { type: 'PoisonChanged', target: self, amount: -amount }],
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
      minionsDiscarded: c.minionsDiscarded + removed,
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
