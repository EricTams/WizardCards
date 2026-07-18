/**
 * compile — the whole DSL pipeline in one call: English text -> action producers.
 *
 * This is what the Card Lab, the card test runner, and the card test suite call.
 * It lives in its own module (rather than `cards/index.ts`) so lower-level pieces
 * like the test runner can depend on it without importing the whole public
 * surface — keeping the module graph acyclic.
 *
 * Diagnostics from the earliest failing stage are returned so errors point at the
 * source.
 */
import { type Diagnostic, type Result, err } from '@shared/index';
import { parse } from '@cards/dsl/parser';
import { resolve, type ActionProducer } from '@cards/dsl/resolver';

export function compile(text: string): Result<ActionProducer[], Diagnostic[]> {
  const parsed = parse(text);
  if (!parsed.ok) return err(parsed.errors);
  return resolve(parsed.value);
}
