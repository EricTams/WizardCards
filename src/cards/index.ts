/**
 * cards — public API surface.
 *
 * Exposes the DSL pipeline, card definitions, and the registry. Imports from
 * `engine` and `shared` only (never `ui`).
 */
import { type Diagnostic, type Result, ok, err } from '@shared/index';
import { parse } from '@cards/dsl/parser';
import { resolve, type ActionProducer } from '@cards/dsl/resolver';

export type { Token, TokenType } from '@cards/dsl/tokenizer';
export { tokenize } from '@cards/dsl/tokenizer';
export type { CardScript, EffectNode, Verb } from '@cards/dsl/ast';
export { parse } from '@cards/dsl/parser';
export { resolve, type ActionProducer, type PlayContext } from '@cards/dsl/resolver';

export type { CardDef } from '@cards/registry';
export { ALL_CARDS, getCard } from '@cards/registry';

export type { CardOverrides } from '@cards/overrides';
export { EMPTY_OVERRIDES, applyOverrides, hasNoOverrides } from '@cards/overrides';

export type { CardField, ModifiedCard, CardDiff, CardDiffReport } from '@cards/diff';
export { diffCards, isEmptyDiff, buildReport } from '@cards/diff';

/**
 * Run the whole pipeline: English text -> action producers. This is what the
 * Card Lab and the card test suite call. Diagnostics from the earliest failing
 * stage are returned so errors point at the source.
 */
export function compile(text: string): Result<ActionProducer[], Diagnostic[]> {
  const parsed = parse(text);
  if (!parsed.ok) return err(parsed.errors);
  return resolve(parsed.value);
}

export { ok, err };
export type { Result, Diagnostic };
