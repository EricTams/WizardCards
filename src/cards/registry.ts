/**
 * The card registry — the single enumerable source of every card in the game.
 *
 * The test suite iterates this list to guarantee EVERY card parses, resolves,
 * and behaves, so no card can ship untested. The engine references cards only by
 * CardId; this registry maps ids to their authored definitions.
 */
import type { CardId } from '@shared/index';
import { CLOUD_CARDS } from '@cards/definitions/cloud';
import { WIZARD_CARDS } from '@cards/definitions/wizard';
import { CLOUD_PERSISTENTS } from '@cards/definitions/cloud-persistents';
import { WIZARD_PERSISTENTS } from '@cards/definitions/wizard-persistents';
import { CRAB_CARDS } from '@cards/definitions/crab';
import { CRAB_PERSISTENTS } from '@cards/definitions/crab-persistents';
import { WRITER_CARDS } from '@cards/definitions/writer';
import { WRITER_PERSISTENTS } from '@cards/definitions/writer-persistents';

export interface CardDef {
  readonly id: CardId;
  readonly name: string;
  /** Energy cost to play. */
  readonly cost: number;
  /** The card's behavior, authored in the English card language. */
  readonly text: string;
}

/**
 * Persistent (ongoing) cards. Kept as a distinct list because they behave
 * differently — they have no immediate on-play effect; their trigger text drives
 * behavior while they're in play (see `src/cards/match`).
 */
export const PERSISTENT_CARDS: readonly CardDef[] = [
  ...CLOUD_PERSISTENTS,
  ...WIZARD_PERSISTENTS,
  ...CRAB_PERSISTENTS,
  ...WRITER_PERSISTENTS,
];

export const ALL_CARDS: readonly CardDef[] = [
  ...CLOUD_CARDS,
  ...WIZARD_CARDS,
  ...CRAB_CARDS,
  ...WRITER_CARDS,
  ...PERSISTENT_CARDS,
];

const BY_ID: ReadonlyMap<CardId, CardDef> = new Map(
  ALL_CARDS.map((card) => [card.id, card]),
);

export function getCard(id: CardId): CardDef | undefined {
  return BY_ID.get(id);
}
