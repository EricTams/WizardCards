/**
 * The Crab — persistent (ongoing) cards, authored in English.
 *
 * Crab Trap and Exoskeleton are what today's trigger grammar can express. The
 * remaining two key off things the engine can't yet observe — how much of your
 * hand you discarded, whether a discarded card had Molt, a deck shuffle — see
 * `docs/roadmap.md`.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const CRAB_TRAP: CardDef = {
  id: cardId('crab-crab-trap'),
  name: 'Crab Trap',
  cost: 1,
  text: 'At the start of your turn, draw 1 card, gain 1 energy.',
};

/** Turtle up, then cash the block in for a fresh hand (firing any Molt with it). */
export const EXOSKELETON: CardDef = {
  id: cardId('crab-exoskeleton'),
  name: 'Exoskeleton',
  cost: 1,
  text: 'At the end of your turn, if you have 5 or more defense, discard your hand, draw 5 cards.',
};

/** The big-churn payoff: ten discards in one turn hits the whole table. */
export const DECAPOD: CardDef = {
  id: cardId('crab-decapod'),
  name: 'Decapod',
  cost: 1,
  text: 'When you discard a card, if you have discarded 10 or more cards, deal 10 damage to all opponents.',
};

/** "Discard your entire hand" — checked as the hand being empty afterwards. */
export const EYESTALKS: CardDef = {
  id: cardId('crab-eyestalks'),
  name: 'Eyestalks',
  cost: 1,
  text: 'When you discard a card, if you have fewer than 1 card in hand, gain 2 energy.',
};

export const PRAWN: CardDef = {
  id: cardId('crab-prawn'),
  name: 'Prawn',
  cost: 1,
  text: 'When you discard a card with molt, deal 3 damage.',
};

export const DECORATOR: CardDef = {
  id: cardId('crab-decorator'),
  name: 'Decorator',
  cost: 1,
  text: 'When you shuffle your deck, add molt to the top card of your draw pile.',
};

export const CRAB_PERSISTENTS: readonly CardDef[] = [
  CRAB_TRAP,
  EXOSKELETON,
  DECAPOD,
  EYESTALKS,
  PRAWN,
  DECORATOR,
];
