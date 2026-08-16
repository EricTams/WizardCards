/**
 * Per-copy card keywords — the properties a card has *as a card*, rather than
 * effects it produces: the Crab's Molt, the Old Lady's Blank and Add, and the
 * Writer's Fading.
 *
 * They all share one problem. The ENGINE has to act on them — it selects which
 * copies to discard at end of turn (Fading), counts Blank cards in hand, and
 * refuses to play an Add card outside a Blank window — but the engine can't read
 * card text. So the printed keyword is *stamped onto the copies* wherever the
 * cards layer creates them (`stampPrintedKeywords`), and each
 * `CardInstance` flag covers printed and granted alike (Retirement grants Add,
 * Search grants Fading, Skitter grants Molt). A copy minted by a future
 * engine-side "create a copy" effect would miss the stamp; create copies from an
 * existing instance (as `moveFromDiscard` does) and the marks ride along.
 *
 * Also here: `burnCostOf`, since Burn is a *cost* rather than an effect — a
 * Writer card that burns Craft can only be played with that much Craft banked.
 */
import type { CardInstance } from '@engine/index';
import { entityId, type CardId } from '@shared/index';
import { parse } from '@cards/dsl/parser';
import { compile } from '@cards/compile';
import { getCard, type CardDef } from '@cards/registry';
import type { PlayContext } from '@cards/dsl/resolver';

/** The keyword flags a copy can carry — the CardInstance fields, by name. */
export interface CardKeywords {
  readonly molt: boolean;
  readonly blank: boolean;
  readonly add: boolean;
  readonly fading: boolean;
}

const NONE: CardKeywords = { molt: false, blank: false, add: false, fading: false };

/** Memoized by card id — a card's text is static, so parse it at most once. */
const cache = new Map<CardId, CardKeywords>();

/** The keywords printed on a card's text (`Molt.` on a line of its own). */
export function printedKeywords(card: CardDef): CardKeywords {
  const cached = cache.get(card.id);
  if (cached) return cached;
  const parsed = parse(card.text);
  const has = (m: string) => parsed.ok && parsed.value.modifiers.some((x) => x.modifier === m);
  const keywords: CardKeywords = parsed.ok
    ? { molt: has('molt'), blank: has('blank'), add: has('add'), fading: has('fading') }
    : NONE;
  cache.set(card.id, keywords);
  return keywords;
}

/** Does this card carry printed Molt? (Kept as its own name — Molt reads a lot.) */
export function hasMolt(card: CardDef): boolean {
  return printedKeywords(card).molt;
}

/**
 * Stamp printed keywords onto freshly-minted copies. Every path that wraps card
 * ids as instances (battle setup, test fixtures) runs its cards through this, so
 * the reducer can trust the instance flags alone. Ids that aren't in the
 * registry (test placeholders) pass through unstamped.
 */
export function stampPrintedKeywords(instances: readonly CardInstance[]): CardInstance[] {
  return instances.map((inst) => {
    const card = getCard(inst.cardId);
    if (!card) return inst;
    const printed = printedKeywords(card);
    // Molt stays off the instance: it is read from the card's text at discard
    // time, and stamping it would make "add molt to a card" skip every Molt card.
    const stamped = {
      ...inst,
      ...(printed.blank ? { blank: true } : {}),
      ...(printed.add ? { add: true } : {}),
      ...(printed.fading ? { fading: true } : {}),
    };
    return stamped;
  });
}

/**
 * How much Craft this card's Burn spends — "Burn 3 — Deal 5 Damage". The design
 * treats Burn as a cost ("Highlighter: the first Burn card has -2 cost"), so a
 * Burn card needs that much Craft banked to be playable at all. A Burn-all
 * (Dumpster Diver) costs nothing to attempt: it spends whatever is there.
 */
export function burnCostOf(card: CardDef): number {
  const compiled = compile(card.text);
  if (!compiled.ok) return 0;
  // Producers only close over the play context; any context yields the same
  // action shapes, so a placeholder is fine for *counting*.
  const probe: PlayContext = { self: entityId('probe'), target: entityId('probe'), sourceCard: card.id };
  return compiled.value
    .map((produce) => produce(probe))
    .reduce((n, a) => n + (a.type === 'BurnCraft' ? (a.amount ?? 0) : 0), 0);
}
