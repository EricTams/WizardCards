/**
 * Compile a persistent card's English text into runtime trigger behavior.
 *
 * This is where the trigger *grammar* meets the trigger *system*: `parse` turns
 * the card text into TriggerNodes/ModifierNodes, and this module turns those into
 * the hooks the `match` orchestrator already knows how to fire — `onEvent`,
 * `onStartTurn`, `onEndTurn`, plus the `snowHealBonus`/`suppressFogDiscard`
 * modifiers. Behavior is a pure function of state + the event that fired it, so
 * the whole thing stays deterministic and replayable.
 */
import { metricValue, type Action, type GameEvent, type GameState } from '@engine/index';
import { parse } from '@cards/dsl/parser';
import type { EffectNode, TriggerCondition, TriggerNode } from '@cards/dsl/ast';
import { CLOUD_CAP } from '@cards/match/content';

export interface PersistentBehavior {
  readonly onEvent?: (state: GameState, event: GameEvent) => Action[];
  readonly onStartTurn?: (state: GameState) => Action[];
  readonly onEndTurn?: (state: GameState) => Action[];
  readonly snowHealBonus?: number;
  readonly suppressFogDiscard?: boolean;
}

export function compilePersistent(text: string): PersistentBehavior {
  const parsed = parse(text);
  if (!parsed.ok) return {};
  const { triggers, modifiers } = parsed.value;

  let snowHealBonus = 0;
  let suppressFogDiscard = false;
  for (const mod of modifiers) {
    if (mod.modifier === 'snowHealBonus') snowHealBonus += mod.amount ?? 1;
    if (mod.modifier === 'suppressFogDiscard') suppressFogDiscard = true;
  }

  const reactive = triggers.filter((t) => t.event !== 'startTurn' && t.event !== 'endTurn');
  const startTriggers = triggers.filter((t) => t.event === 'startTurn');
  const endTriggers = triggers.filter((t) => t.event === 'endTurn');

  return {
    ...(reactive.length > 0
      ? { onEvent: (state: GameState, event: GameEvent) => reactive.flatMap((t) => fireReactive(t, state, event)) }
      : {}),
    ...(startTriggers.length > 0
      ? { onStartTurn: (state: GameState) => startTriggers.flatMap((t) => firePhase(t, state)) }
      : {}),
    ...(endTriggers.length > 0
      ? { onEndTurn: (state: GameState) => endTriggers.flatMap((t) => firePhase(t, state)) }
      : {}),
    ...(snowHealBonus !== 0 ? { snowHealBonus } : {}),
    ...(suppressFogDiscard ? { suppressFogDiscard: true } : {}),
  };
}

/** A reactive trigger: match the event, gate on any condition, fire per unit. */
function fireReactive(trigger: TriggerNode, state: GameState, event: GameEvent): Action[] {
  const times = firingCount(trigger, state, event);
  if (times <= 0) return [];
  if (trigger.condition && !conditionHolds(state, trigger.condition)) return [];
  const actions: Action[] = [];
  for (let i = 0; i < times; i++) actions.push(...resolveTriggerEffects(trigger.effects, state));
  return actions;
}

/** A phase trigger (start/end of turn): fire once if its condition holds. */
function firePhase(trigger: TriggerNode, state: GameState): Action[] {
  if (trigger.condition && !conditionHolds(state, trigger.condition)) return [];
  return resolveTriggerEffects(trigger.effects, state);
}

/**
 * How many times a reactive trigger fires for one event — "whenever you create a
 * cloud" fires once per cloud created, "when a minion is discarded" once per
 * minion, etc.
 */
function firingCount(trigger: TriggerNode, state: GameState, event: GameEvent): number {
  switch (trigger.event) {
    case 'createCloud':
      return event.type === 'CloudsCreated' ? event.count : 0;
    case 'removeCloud':
      if (event.type !== 'CloudsRemoved') return 0;
      return trigger.cloudType
        ? event.removed.filter((c) => c === trigger.cloudType).length
        : event.count;
    case 'dealUnblockedDamage':
      return event.type === 'DamageDealt' && event.unblocked > 0 && isEnemy(state, event.target) ? 1 : 0;
    case 'discardMinion':
      return event.type === 'MinionDiscarded' ? event.count : 0;
    default:
      return 0;
  }
}

function resolveTriggerEffects(effects: readonly EffectNode[], state: GameState): Action[] {
  return effects.flatMap((effect) => resolveTriggerEffect(effect, state));
}

/** Resolve one trigger effect to atomic actions. `self` is the persistent's owner. */
function resolveTriggerEffect(effect: EffectNode, state: GameState): Action[] {
  const self = state.player.id;
  const amount = effect.amount ?? 0;
  switch (effect.verb) {
    case 'deal': {
      // Trigger effects resolve with state in hand, so scaling is computed here.
      const dealt = effect.scale ? (effect.amount ?? 1) * metricValue(state, self, effect.scale.per) : amount;
      const target = effect.target ?? 'randomEnemy';
      if (target === 'allEnemies') {
        return state.enemies.filter((e) => e.hp > 0).map((e) => ({ type: 'DealDamage', target: e.id, amount: dealt }));
      }
      return [{ type: 'DealDamageToRandomEnemy', amount: dealt }];
    }
    case 'heal':
      return [{ type: 'Heal', target: self, amount }];
    case 'poison':
      return [{ type: 'GainPoison', target: self, amount }];
    case 'draw':
      return [{ type: 'DrawCards', count: amount }];
    case 'create':
      if (effect.noun === 'randomClouds') return [{ type: 'CreateRandomClouds', target: self, count: amount }];
      return [{ type: 'CreateClouds', target: self, cloudType: effect.cloudType!, count: amount }];
    case 'fill':
      return [{ type: 'FillCloudSlots', target: self, baseCap: CLOUD_CAP }];
    case 'remove':
      // Mirrors the on-play resolver — see the note on `discard` below.
      if (effect.noun === 'allClouds') return [{ type: 'RemoveAllClouds', target: self }];
      if (effect.noun === 'randomClouds') return [{ type: 'RemoveRandomClouds', target: self, count: amount }];
      return [{ type: 'RemoveClouds', target: self, count: amount }];
    case 'increase':
      return [{ type: 'IncreaseMaxClouds', target: self, amount }];
    case 'discard':
      // Must mirror the on-play resolver's noun handling — before this, every
      // `discard` in a trigger became DiscardMinion, so "discard 1 card" and
      // "discard your hand" silently discarded minions instead.
      if (effect.noun === 'minion') return [{ type: 'DiscardMinion', owner: self, count: amount }];
      if (effect.noun === 'hand') return [{ type: 'DiscardHand', owner: self }];
      return [{ type: 'DiscardCards', owner: self, count: amount }];
    case 'gain':
      return resolveGain(effect.noun, self, amount);
    default:
      return [];
  }
}

function resolveGain(noun: string | undefined, self: GameState['player']['id'], amount: number): Action[] {
  switch (noun) {
    case 'block':
      return [{ type: 'GainBlock', target: self, amount }];
    case 'shield':
      return [{ type: 'GainShield', target: self, amount }];
    case 'energy':
      return [{ type: 'GainEnergy', target: self, amount }];
    case 'power':
      return [{ type: 'GainPower', target: self, amount }];
    case 'bravery':
      return [{ type: 'GainBravery', target: self, amount }];
    default:
      return [];
  }
}

function conditionHolds(state: GameState, condition: TriggerCondition): boolean {
  const value = playerResource(state, condition.resource);
  return condition.op === 'gt' ? value > condition.amount : value >= condition.amount;
}

function playerResource(state: GameState, resource: string): number {
  const p = state.player;
  switch (resource) {
    case 'energy':
      return p.energy;
    case 'block':
      return p.block;
    case 'shield':
      return p.shield;
    case 'defense':
      return p.block + p.shield;
    case 'poison':
      return p.poison;
    case 'power':
      return p.power;
    case 'bravery':
      return p.bravery;
    case 'hp':
      return p.hp;
    default:
      return 0;
  }
}

const isEnemy = (state: GameState, id: string): boolean => state.enemies.some((e) => e.id === id);
