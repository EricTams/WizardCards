/**
 * shared — the foundation layer.
 *
 * Types and helpers used by more than one layer. Depends on NOTHING else in the
 * project (enforced by eslint-plugin-boundaries). Keep this small and pure.
 */

/** A branded string id, so an EntityId can't be mixed up with a CardId, etc. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type CardId = Brand<string, 'CardId'>;
export type EntityId = Brand<string, 'EntityId'>;

export const cardId = (raw: string): CardId => raw as CardId;
export const entityId = (raw: string): EntityId => raw as EntityId;

/**
 * The four kinds of cloud the Cloud character creates. Lives in `shared` because
 * both the engine (cloud state) and the card DSL (the `create clouds` grammar)
 * refer to it, and shared may depend on nothing.
 */
export type CloudType = 'lightning' | 'storm' | 'snow' | 'fog';

/** All cloud types, in a stable order (handy for iteration / UI). */
export const CLOUD_TYPES: readonly CloudType[] = ['lightning', 'storm', 'snow', 'fog'];

/**
 * The five playable characters ("wanderers"). A serializable tag carried on a
 * Combatant so the UI can pick the right hero/deck art; the engine itself is
 * character-agnostic. Only `cloud` and `wizard` have authored cards today.
 */
export type CharacterId = 'cloud' | 'wizard' | 'crab' | 'oldLady' | 'writer';

/**
 * A quantity an effect can scale off of, measured against the caster at reduce
 * time — "equal to your energy" / "for each unique cloud". Lives in `shared`
 * because both the engine (computes it) and the DSL (parses it) refer to it.
 */
export type ScaleMetric =
  | 'energy'
  | 'poison'
  | 'block'
  | 'shield'
  /** Block + Shield combined — your total defensive armor. */
  | 'defense'
  | 'power'
  | 'bravery'
  | 'clouds'
  | 'uniqueClouds'
  | 'minions';

/**
 * Result — the return type of every fallible pure stage (parser stages, move
 * validation, …). Diagnostics carry source positions so the Card Lab can point
 * at exactly where something went wrong.
 */
export type Result<T, E = Diagnostic[]> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(errors: E): Result<never, E> => ({ ok: false, errors });

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/** A message tied to a half-open span [start, end) of the source text. */
export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly start: number;
  readonly end: number;
}
