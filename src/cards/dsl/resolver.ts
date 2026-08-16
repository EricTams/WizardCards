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
import { type Diagnostic, type Result, ok, err, type CardId, type EntityId, type MarkKind } from '@shared/index';
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
  // "Next turn, gain 2 shields" — promise the resource instead of granting it.
  if (effect.when === 'nextTurn') return resolveNextTurn(effect, diagnostics);
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
      // `self` rides along so the reducer can apply the Old Lady's Power to the
      // first attack of the turn; every other damage path already carries it.
      return (ctx) => ({ type: 'DealDamage', target: ctx.target, amount, self: ctx.self });
    case 'gain':
      if (effect.scale) {
        const per = effect.scale.per;
        const multiplier = effect.amount ?? 1;
        const resource = effect.noun as 'block' | 'shield' | 'energy' | 'power' | 'bravery';
        return (ctx) => ({ type: 'GainScaled', self: ctx.self, target: ctx.self, resource, per, multiplier });
      }
      // "…to all opponents" on a resource gain: only Power says this today
      // (Challenge hands the table a point of Power along with its own).
      if (effect.target === 'allEnemies' && effect.noun === 'power') {
        return (ctx) => ({ type: 'GainPowerAll', self: ctx.self, amount });
      }
      return resolveGain(effect, diagnostics);
    case 'heal':
      if (effect.scale) {
        // "Heal equal to the power lost" — Mend spends Power for exactly that
        // much HP, which is one action so the two halves can't disagree.
        if (effect.scale.per === 'power') return (ctx) => ({ type: 'ConvertPowerToHeal', target: ctx.self });
        diagnostics.push({
          severity: 'error',
          message: 'Only "heal equal to your power" scales heal today.',
          start: effect.start,
          end: effect.end,
        });
        return null;
      }
      return (ctx) => ({ type: 'Heal', target: ctx.self, amount });
    case 'lose':
      switch (effect.noun) {
        case 'hp':
          return (ctx) => ({ type: 'LoseHp', target: ctx.self, amount });
        case 'power':
          return (ctx) => ({ type: 'GainPower', target: ctx.self, amount: -amount });
        case 'all-power':
          // Mend's other half. Zeroing Power without healing is the same action
          // with the heal ignored, so this stays a single, total effect.
          return (ctx) => ({ type: 'ConvertPowerToHeal', target: ctx.self });
        case 'all-defense':
          return (ctx) => ({ type: 'DefenseToBravery', target: ctx.self, gain: false });
        default:
          diagnostics.push({
            severity: 'error',
            message: `Don't know how to lose "${String(effect.noun)}".`,
            start: effect.start,
            end: effect.end,
          });
          return null;
      }
    case 'craft':
      if (effect.scale) {
        const per = effect.scale.per;
        const multiplier = effect.amount ?? 1;
        return (ctx) => ({ type: 'GainScaled', self: ctx.self, target: ctx.self, resource: 'craft', per, multiplier });
      }
      return (ctx) => ({ type: 'GainCraft', target: ctx.self, amount });
    case 'mark':
      if (effect.mark === 'random') {
        return (ctx) => ({ type: 'MarkCardsRandomKind', owner: ctx.self, value: amount, count: effect.count ?? 1 });
      }
      {
        const mark = effect.mark as MarkKind;
        const count = effect.count ?? 1;
        const scope = effect.scope ?? 'hand';
        return (ctx) => ({ type: 'MarkCards', owner: ctx.self, mark, value: amount, count, scope });
      }
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
      if (effect.noun === 'clouds') return (ctx) => ({ type: 'SetCloudsPlayTwice', target: ctx.self, value: true });
      return (ctx) => ({
        type: 'DoubleResource',
        target: ctx.self,
        resource: effect.noun as 'bravery' | 'poison' | 'craft',
      });
    case 'add':
      if (effect.noun === 'moltDrawTop') return (ctx) => ({ type: 'AddMoltToDrawTop', owner: ctx.self });
      return (ctx) => ({
        type: 'AddKeywordToHand',
        owner: ctx.self,
        keyword: effect.noun as 'molt' | 'add' | 'fading',
        count: amount,
      });
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
      if (effect.noun === 'markings') return (ctx) => ({ type: 'ClearMarks', owner: ctx.self });
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
        ? (ctx) => ({ type: 'BurnCraft', target: ctx.self })
        : (ctx) => ({ type: 'BurnCraft', target: ctx.self, amount: effect.amount ?? 1 });
    case 'set':
      if (effect.noun === 'craft') return (ctx) => ({ type: 'SetCraft', target: ctx.self, amount });
      // "Set your defense to zero" strips block and shield (Cheater, which has
      // already converted it to Bravery by the time this runs).
      if (effect.noun === 'defense') return (ctx) => ({ type: 'DefenseToBravery', target: ctx.self, gain: false });
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

/** Resources a "Next turn, …" clause can promise (Trophy, Well Rested, Destroy). */
const NEXT_TURN_RESOURCES = new Set(['energy', 'power', 'bravery', 'craft', 'shield']);

/**
 * "Next turn, gain 2 shields" / "Next turn, craft 3" — a promise the
 * start-of-turn cascade pays out (`ApplyNextTurn`), not an effect that happens
 * now. Only resource gains can be deferred; anything else is a diagnostic.
 */
function resolveNextTurn(effect: EffectNode, diagnostics: Diagnostic[]): ActionProducer | null {
  const resource = effect.verb === 'craft' ? 'craft' : effect.verb === 'gain' ? effect.noun : undefined;
  const amount = effect.amount ?? 0;
  if (!resource || !NEXT_TURN_RESOURCES.has(resource)) {
    diagnostics.push({
      severity: 'error',
      message: '"Next turn, …" only supports gaining energy, power, bravery, craft or shields.',
      start: effect.start,
      end: effect.end,
    });
    return null;
  }
  return (ctx) => ({
    type: 'GrantNextTurn',
    target: ctx.self,
    resource: resource as 'energy' | 'power' | 'bravery' | 'craft' | 'shield',
    amount,
  });
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
