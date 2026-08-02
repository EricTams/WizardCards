/**
 * Unplayable & Burn — the Writer's keyword pair: "Unplayable — cannot be played
 * regularly. Still contains effects." and "Burn X — discard X Unplayable cards,
 * triggering all effects on them."
 *
 * Like Molt, an Unplayable card acts from the hand rather than the play area,
 * so it hangs off an event: `BurnCards` moves the copies to the discard pile and
 * raises `CardsBurned`, and `burnTriggers` (folded into the same reactive
 * cascade as Molt) plays each burned card's effects for free.
 *
 * Unlike Molt, the ENGINE has to know which copies are Unplayable — the reducer
 * selects Burn's targets and counts Find's hits — and the engine can't read card
 * text. So the printed keyword is *stamped onto the copies* wherever the cards
 * layer creates them (`stampPrintedKeywords`), and `CardInstance.unplayable`
 * covers printed and granted (Trash Can) alike. A copy minted by a future
 * engine-side "create a copy" effect would miss the stamp; create copies from an
 * existing instance (as `moveFromDiscard` does) and the mark rides along.
 */
import { opponentsOf, type Action, type CardInstance, type GameEvent, type GameState } from '@engine/index';
import { entityId, type CardId } from '@shared/index';
import { parse } from '@cards/dsl/parser';
import { compile } from '@cards/compile';
import { getCard, type CardDef } from '@cards/registry';
import type { PlayContext } from '@cards/dsl/resolver';

/** Memoized by card id — a card's text is static, so parse it at most once. */
const unplayableCache = new Map<CardId, boolean>();

/** Does this card's text carry the printed Unplayable keyword? */
export function hasUnplayable(card: CardDef): boolean {
  const cached = unplayableCache.get(card.id);
  if (cached !== undefined) return cached;
  const parsed = parse(card.text);
  const unplayable = parsed.ok && parsed.value.modifiers.some((m) => m.modifier === 'unplayable');
  unplayableCache.set(card.id, unplayable);
  return unplayable;
}

/**
 * Stamp printed keywords onto freshly-minted copies. Every path that wraps card
 * ids as instances (battle setup, test fixtures) runs its cards through this, so
 * the reducer can trust `instance.unplayable` alone. Ids that aren't in the
 * registry (test placeholders) pass through unstamped.
 */
export function stampPrintedKeywords(instances: readonly CardInstance[]): CardInstance[] {
  return instances.map((inst) => {
    const card = getCard(inst.cardId);
    if (!card || inst.unplayable || !hasUnplayable(card)) return inst;
    return { ...inst, unplayable: true };
  });
}

/**
 * How many Unplayable cards this card demands as its Burn cost — the design
 * treats Burn as a cost ("Highlighter: …does not cost unplayable cards to
 * play"), so a Burn card needs that many in hand to be playable. Burn-all
 * (Inspiration) costs nothing: it spends whatever is there.
 */
export function burnCostOf(card: CardDef): number {
  const compiled = compile(card.text);
  if (!compiled.ok) return 0;
  // Producers only close over the play context; any context yields the same
  // action shapes, so a placeholder is fine for *counting*.
  const probe: PlayContext = { self: entityId('probe'), target: entityId('probe'), sourceCard: card.id };
  return compiled.value
    .map((produce) => produce(probe))
    .reduce((n, a) => n + (a.type === 'BurnCards' ? (a.count ?? 0) : 0), 0);
}

/**
 * The free plays one `CardsBurned` event owes: every burned card's effects —
 * "trigger all effects on them". Mirrors Molt's free plays: no energy is spent,
 * and with nobody clicking a target, damage aims at the owner's first opponent.
 */
export function burnTriggers(state: GameState, event: GameEvent): Action[] {
  if (event.type !== 'CardsBurned') return [];
  const target = opponentsOf(state, event.owner)[0]?.id ?? event.owner;
  return event.instances.flatMap((instance) => {
    const card = getCard(instance.cardId);
    if (!card) return [];
    const compiled = compile(card.text);
    if (!compiled.ok) return [];
    const ctx: PlayContext = { self: event.owner, target, sourceCard: instance.cardId };
    return compiled.value.map((produce) => produce(ctx));
  });
}
