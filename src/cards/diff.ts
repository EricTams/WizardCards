/**
 * Card diffing — compares a current card list against the baseline and produces
 * a serializable report. A user runs this in the Card Lab and sends us the JSON;
 * we apply it to `src/cards/definitions` to patch the real card list.
 *
 * Pure: deterministic, no timestamps or I/O. The caller (ui) supplies
 * `generatedAt` when wrapping a diff into a report, so this stays testable.
 */
import type { CardDef } from '@cards/registry';

export type CardField = 'name' | 'cost' | 'text';

const FIELDS: readonly CardField[] = ['name', 'cost', 'text'];

export interface ModifiedCard {
  readonly id: string;
  readonly changedFields: readonly CardField[];
  readonly before: CardDef;
  readonly after: CardDef;
}

export interface CardDiff {
  readonly added: readonly CardDef[];
  readonly modified: readonly ModifiedCard[];
  readonly removed: readonly CardDef[];
}

export function diffCards(
  baseline: readonly CardDef[],
  current: readonly CardDef[],
): CardDiff {
  const baseById = new Map(baseline.map((c) => [c.id as string, c]));
  const curIds = new Set(current.map((c) => c.id as string));

  const added: CardDef[] = [];
  const modified: ModifiedCard[] = [];
  const removed: CardDef[] = [];

  for (const cur of current) {
    const base = baseById.get(cur.id);
    if (!base) {
      added.push(cur);
      continue;
    }
    const changedFields = FIELDS.filter((f) => base[f] !== cur[f]);
    if (changedFields.length > 0) {
      modified.push({ id: cur.id, changedFields, before: base, after: cur });
    }
  }

  for (const base of baseline) {
    if (!curIds.has(base.id)) removed.push(base);
  }

  return { added, modified, removed };
}

export function isEmptyDiff(diff: CardDiff): boolean {
  return diff.added.length === 0 && diff.modified.length === 0 && diff.removed.length === 0;
}

/** A self-describing, shareable report. `generatedAt` is supplied by the caller. */
export interface CardDiffReport {
  readonly kind: 'wizardcards.card-diff';
  readonly version: 1;
  readonly generatedAt: string;
  readonly summary: { readonly added: number; readonly modified: number; readonly removed: number };
  readonly diff: CardDiff;
}

export function buildReport(diff: CardDiff, generatedAt: string): CardDiffReport {
  return {
    kind: 'wizardcards.card-diff',
    version: 1,
    generatedAt,
    summary: {
      added: diff.added.length,
      modified: diff.modified.length,
      removed: diff.removed.length,
    },
    diff,
  };
}
