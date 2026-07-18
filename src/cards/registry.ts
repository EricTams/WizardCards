/**
 * The card registry — the single enumerable source of every card in the game.
 *
 * The test suite iterates this list to guarantee EVERY card parses, resolves,
 * and behaves, so no card can ship untested. The engine references cards only by
 * CardId; this registry maps ids to their authored definitions.
 */
import type { CardId } from '@shared/index';
import { STRIKE, DEFEND, INSIGHT, CLEAVE } from '@cards/definitions/starter';

export interface CardDef {
  readonly id: CardId;
  readonly name: string;
  /** Energy cost to play. */
  readonly cost: number;
  /** The card's behavior, authored in the English card language. */
  readonly text: string;
}

export const ALL_CARDS: readonly CardDef[] = [STRIKE, DEFEND, INSIGHT, CLEAVE];

const BY_ID: ReadonlyMap<CardId, CardDef> = new Map(
  ALL_CARDS.map((card) => [card.id, card]),
);

export function getCard(id: CardId): CardDef | undefined {
  return BY_ID.get(id);
}
