/**
 * The Crab — persistent (ongoing) cards, authored in English.
 *
 * Crab Trap and Exoskeleton are what today's trigger grammar can express. The
 * remaining five key off things the engine can't yet observe — how much of your
 * hand you discarded, whether a discarded card had Claw, a deck shuffle — see
 * `docs/roadmap.md`.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const CRAB_TRAP: CardDef = {
  id: cardId('crab-crab-trap'),
  name: 'Crab Trap',
  cost: 1,
  text: 'At the start of your turn, draw 1 additional card.',
};

/** Turtle up, then cash the block in for a fresh hand (firing any Claw with it). */
export const EXOSKELETON: CardDef = {
  id: cardId('crab-exoskeleton'),
  name: 'Exoskeleton',
  cost: 1,
  text: 'At the end of your turn, if you have 5 or more block, discard your hand, draw 4 cards.',
};

export const CRAB_PERSISTENTS: readonly CardDef[] = [CRAB_TRAP, EXOSKELETON];
