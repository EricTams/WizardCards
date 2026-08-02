/**
 * Resolver: CardScript AST -> atomic-action producers.
 *
 * The resolver does NOT return actions directly, because an action often needs
 * runtime context that only exists when the card is played (who is the target?
 * which card is this, for a minion copy?). Instead it returns *producers*: pure
 * functions from a PlayContext to the atomic Actions the engine reducer applies.
 *
 * text -> tokens -> AST -> [producers] --(at play time, given context)--> [Action]
 */
import { type Diagnostic, type Result, ok, err, type CardId, type EntityId } from '@shared/index';
import type { Action } from '@engine/index';
import type { CardScript, EffectNode } from '@cards/dsl/ast';
import { CLOUD_CAP } from '@cards/match/content';

/** Everything a producer might need that's only known when the card is played. */
export interface PlayContext {
  /** The combatant playing the card (usually the player). */
  readonly self: EntityId;
  /** The chosen enemy for targeted effects like "deal damage". */
  readonly target: EntityId;
  /** The card being played — a minion effect summons a copy of it. */
  readonly sourceCard: CardId;
}

export type ActionProducer = (ctx: PlayContext) => Action;

export function resolve(script: CardScript): Result<ActionProducer[], Diagnostic[]> {
  const producers: ActionProducer[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const effect of script.effects) {
    const producer = resolveEffect(effect, diagnostics);
    if (producer) producers.push(producer);
  }

  if (diagnostics.length > 0) return err(diagnostics);
  return ok(producers);
}

function resolveEffect(effect: EffectNode, diagnostics: Diagnostic[]): ActionProducer | null {
  // A Find rider ("If you find an unplayable card, …") resolves like the bare
  // effect, then wraps it in the conditional action the reducer gates.
  if (effect.when === 'foundUnplayable') {
    const { when, ...bare } = effect;
    void when; // dropped so the recursive resolve takes the bare-effect path
    const inner = resolveEffect(bare, diagnostics);
    if (!inner) return null;
    return (ctx) => ({ type: 'IfFoundUnplayable', owner: ctx.self, action: inner(ctx) });
  }
  const amount = effect.amount ?? 0;
  switch (effect.verb) {
    case 'deal':
      if (effect.scale) {
        const per = effect.scale.per;
        const multiplier = effect.amount ?? 1;
        return (ctx) => ({ type: 'DealDamageScaled', self: ctx.self, target: ctx.target, per, multiplier });
      }
      // "…to all opponents" / "…to a random opponent" override the chosen target.
      if (effect.target === 'allEnemies') return (ctx) => ({ type: 'DealDamageToAll', self: ctx.self, amount });
      if (effect.target === 'randomEnemy') return (ctx) => ({ type: 'DealDamageToRandomEnemy', self: ctx.self, amount });
      return (ctx) => ({ type: 'DealDamage', target: ctx.target, amount });
    case 'gain':
      if (effect.scale) {
        const per = effect.scale.per;
        const multiplier = effect.amount ?? 1;
        const resource = effect.noun as 'block' | 'shield' | 'energy' | 'power' | 'bravery';
        return (ctx) => ({ type: 'GainScaled', self: ctx.self, target: ctx.self, resource, per, multiplier });
      }
      return resolveGain(effect, diagnostics);
    case 'heal':
      return (ctx) => ({ type: 'Heal', target: ctx.self, amount });
    case 'poison':
      if (effect.scale) {
        const per = effect.scale.per;
        const multiplier = effect.amount ?? 1;
        return (ctx) => ({
          type: 'GainScaled',
          self: ctx.self,
          target: ctx.self,
          resource: 'poison',
          per,
          multiplier,
        });
      }
      return (ctx) => ({ type: 'GainPoison', target: ctx.self, amount });
    case 'draw':
      return (ctx) => ({ type: 'DrawCards', owner: ctx.self, count: amount });
    case 'increase':
      return (ctx) => ({ type: 'IncreaseMaxClouds', target: ctx.self, amount });
    case 'create':
      if (effect.noun === 'randomClouds') {
        return (ctx) => ({ type: 'CreateRandomClouds', target: ctx.self, count: amount });
      }
      return (ctx) => ({
        type: 'CreateClouds',
        target: ctx.self,
        cloudType: effect.cloudType!,
        count: amount,
      });
    case 'fill':
      return (ctx) => ({ type: 'FillCloudSlots', target: ctx.self, baseCap: CLOUD_CAP });
    case 'double':
      return (ctx) => ({ type: 'SetCloudsPlayTwice', target: ctx.self, value: true });
    case 'add':
      if (effect.noun === 'moltDrawTop') return (ctx) => ({ type: 'AddMoltToDrawTop', owner: ctx.self });
      if (effect.noun === 'unplayableHand') return (ctx) => ({ type: 'AddUnplayableToHand', owner: ctx.self, count: amount });
      return (ctx) => ({ type: 'AddMoltToHand', owner: ctx.self, count: amount });
    case 'return':
      return (ctx) => ({ type: 'ReturnCardToHand', owner: ctx.self, cardId: ctx.sourceCard });
    case 'shuffle':
      return effect.noun === 'thisCard'
        ? (ctx) => ({ type: 'ShuffleCardIntoDrawPile', owner: ctx.self, cardId: ctx.sourceCard })
        : (ctx) => ({ type: 'ShuffleDrawPile', owner: ctx.self });
    case 'move':
      return (ctx) => ({ type: 'MoveDiscardToDrawPile', owner: ctx.self, count: amount });
    case 'retain':
      return (ctx) => ({ type: 'SetVenomRetains', target: ctx.self, value: true });
    case 'remove':
      // "Remove all clouds" (Dissolve) vs a counted "Remove 3 clouds".
      if (effect.noun === 'allClouds') return (ctx) => ({ type: 'RemoveAllClouds', target: ctx.self });
      if (effect.noun === 'randomClouds') {
        return (ctx) => ({ type: 'RemoveRandomClouds', target: ctx.self, count: amount });
      }
      return (ctx) => ({ type: 'RemoveClouds', target: ctx.self, count: amount });
    case 'discard':
      // The noun picks the action: "discard 1 minion" (Wizard), "discard 1 card"
      // or "discard your hand" (Crab). The parser admits only these three.
      if (effect.noun === 'allMinions') return (ctx) => ({ type: 'DiscardAllMinions', owner: ctx.self });
      if (effect.noun === 'drawPile') return (ctx) => ({ type: 'DiscardFromDrawPile', owner: ctx.self, count: amount });
      if (effect.noun === 'minion') return (ctx) => ({ type: 'DiscardMinion', owner: ctx.self, count: amount });
      if (effect.noun === 'hand') return (ctx) => ({ type: 'DiscardHand', owner: ctx.self });
      return (ctx) => ({ type: 'DiscardCards', owner: ctx.self, count: amount });
    case 'burn':
      return effect.noun === 'all'
        ? (ctx) => ({ type: 'BurnCards', owner: ctx.self })
        : (ctx) => ({ type: 'BurnCards', owner: ctx.self, count: effect.amount ?? 1 });
    case 'find':
      return (ctx) => ({ type: 'FindDraw', owner: ctx.self, count: amount });
    case 'set':
      return (ctx) => ({ type: 'SetBravery', target: ctx.self, amount });
    case 'venom':
      return (ctx) => ({ type: 'Venom', self: ctx.self, target: ctx.target });
    case 'drink':
      return (ctx) => ({ type: 'Drink', self: ctx.self });
    case 'minion':
      return (ctx) => ({ type: 'SummonMinion', owner: ctx.self, cardId: ctx.sourceCard });
    default:
      diagnostics.push({
        severity: 'error',
        message: `Don't know how to resolve verb "${effect.verb as string}".`,
        start: effect.start,
        end: effect.end,
      });
      return null;
  }
}

/** `gain` fans out to a different action per resource noun. */
function resolveGain(effect: EffectNode, diagnostics: Diagnostic[]): ActionProducer | null {
  const amount = effect.amount ?? 0;
  switch (effect.noun) {
    case 'block':
      return (ctx) => ({ type: 'GainBlock', target: ctx.self, amount });
    case 'shield':
      return (ctx) => ({ type: 'GainShield', target: ctx.self, amount });
    case 'energy':
      return (ctx) => ({ type: 'GainEnergy', target: ctx.self, amount });
    case 'power':
      return (ctx) => ({ type: 'GainPower', target: ctx.self, amount });
    case 'bravery':
      return (ctx) => ({ type: 'GainBravery', target: ctx.self, amount });
    default:
      diagnostics.push({
        severity: 'error',
        message: `Don't know how to gain "${String(effect.noun)}".`,
        start: effect.start,
        end: effect.end,
      });
      return null;
  }
}
