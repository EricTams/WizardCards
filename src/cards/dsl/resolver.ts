/**
 * Resolver: CardScript AST -> atomic-action producers.
 *
 * The resolver does NOT return actions directly, because an action often needs
 * runtime context that only exists when the card is played (who is the target?
 * which enemy did the player click?). Instead it returns *producers*: pure
 * functions from a PlayContext to the atomic Actions the engine reducer applies.
 *
 * text -> tokens -> AST -> [producers] --(at play time, given context)--> [Action]
 */
import { type Diagnostic, type Result, ok, err, type EntityId } from '@shared/index';
import type { Action } from '@engine/index';
import type { CardScript, EffectNode } from '@cards/dsl/ast';

/** Everything a producer might need that's only known when the card is played. */
export interface PlayContext {
  readonly self: EntityId;
  readonly target: EntityId;
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
  switch (effect.verb) {
    case 'deal':
      return (ctx) => ({ type: 'DealDamage', target: ctx.target, amount: effect.amount });
    case 'gain':
      return (ctx) => ({ type: 'GainBlock', target: ctx.self, amount: effect.amount });
    case 'draw':
      return () => ({ type: 'DrawCards', count: effect.amount });
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
