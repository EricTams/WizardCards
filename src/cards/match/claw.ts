/**
 * Claw — the Crab's keyword: "whenever this card is discarded, it plays for free."
 *
 * Claw is unusual among our triggers. A persistent reacts from the play area, and
 * a minion replays from the board, but a Claw card reacts *as it leaves the hand*
 * — the card itself is the trigger source. So it can't live in `persistents.ts`;
 * it hangs off the `CardsDiscarded` event instead, and the orchestrator folds it
 * into the same reactive cascade as everything else (see `reactiveTriggers`).
 *
 * "For free" means exactly that: no energy is spent, because the card was never
 * played from hand — nothing here touches energy.
 */
import { opponentsOf, type Action, type GameEvent, type GameState } from '@engine/index';
import type { CardId } from '@shared/index';
import { parse } from '@cards/dsl/parser';
import { compile } from '@cards/compile';
import { getCard, type CardDef } from '@cards/registry';
import type { PlayContext } from '@cards/dsl/resolver';

/** Memoized by card id — a card's text is static, so parse it at most once. */
const clawCache = new Map<CardId, boolean>();

/** Does this card carry Claw? (`Claw.` on its own line in the card's text.) */
export function hasClaw(card: CardDef): boolean {
  const cached = clawCache.get(card.id);
  if (cached !== undefined) return cached;
  const parsed = parse(card.text);
  const claw = parsed.ok && parsed.value.modifiers.some((m) => m.modifier === 'claw');
  clawCache.set(card.id, claw);
  return claw;
}

/**
 * The free plays owed for one event: every Claw card in a genuine discard.
 *
 * Only `reason: 'discard'` qualifies. A card moving to the discard pile because
 * it was *played* carries `reason: 'move'` — firing on that would play every Claw
 * card twice — and so does the opening mulligan, which happens before the battle.
 */
export function clawTriggers(state: GameState, event: GameEvent): Action[] {
  if (event.type !== 'CardsDiscarded' || event.reason !== 'discard') return [];

  // Claw plays have no chosen target (nobody clicked anything), so they aim the
  // way a minion's replay does: at the owner's first opponent.
  const target = opponentsOf(state, event.owner)[0]?.id ?? event.owner;

  // Walk the copies, not the ids: Claw can be printed on the card OR granted to
  // one particular copy (Dungeon-ness, Skitter, Decorator).
  return event.instances.flatMap((instance) => {
    const cardId = instance.cardId;
    const card = getCard(cardId);
    if (!card || !(instance.claw === true || hasClaw(card))) return [];
    const compiled = compile(card.text);
    if (!compiled.ok) return [];
    const ctx: PlayContext = { self: event.owner, target, sourceCard: cardId };
    return compiled.value.map((produce) => produce(ctx));
  });
}
