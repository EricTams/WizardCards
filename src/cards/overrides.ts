/**
 * Card overrides — a serializable overlay of edits on top of the baseline card
 * registry. This is what the Card Lab persists (to localStorage, in the ui
 * layer) and what the diff report is computed against.
 *
 * Pure: no browser APIs here. Persistence lives in the ui layer.
 */
import type { CardDef } from '@cards/registry';

export interface CardOverrides {
  readonly version: 1;
  /** Edited or newly-created cards, keyed by CardId. Replaces the baseline entry. */
  readonly edited: Readonly<Record<string, CardDef>>;
  /** Ids of baseline cards the user removed. */
  readonly removed: readonly string[];
}

export const EMPTY_OVERRIDES: CardOverrides = { version: 1, edited: {}, removed: [] };

/**
 * Merge overrides onto the baseline to get the effective card list. Baseline
 * order is preserved; brand-new cards are appended in insertion order.
 */
export function applyOverrides(
  baseline: readonly CardDef[],
  overrides: CardOverrides,
): CardDef[] {
  const removed = new Set(overrides.removed);
  const result: CardDef[] = [];
  const emitted = new Set<string>();

  for (const card of baseline) {
    if (removed.has(card.id)) continue;
    const edit = overrides.edited[card.id];
    result.push(edit ?? card);
    emitted.add(card.id);
  }

  for (const [id, card] of Object.entries(overrides.edited)) {
    if (!emitted.has(id) && !removed.has(id)) result.push(card);
  }

  return result;
}

/** True when the overlay has no edits and no removals. */
export function hasNoOverrides(overrides: CardOverrides): boolean {
  return Object.keys(overrides.edited).length === 0 && overrides.removed.length === 0;
}
