/**
 * Starter card definitions.
 *
 * A card's behavior is authored as English `text`. The DSL compiles that text
 * into atomic-action producers — there is no per-card imperative code. Add a card
 * by adding an entry here and registering it in ../registry.ts; the data-driven
 * test suite then covers it automatically.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const STRIKE: CardDef = {
  id: cardId('strike'),
  name: 'Strike',
  cost: 1,
  text: 'Deal 6 damage.',
};

export const DEFEND: CardDef = {
  id: cardId('defend'),
  name: 'Defend',
  cost: 1,
  text: 'Gain 5 block.',
};

export const INSIGHT: CardDef = {
  id: cardId('insight'),
  name: 'Insight',
  cost: 0,
  text: 'Draw 2 cards.',
};

export const CLEAVE: CardDef = {
  id: cardId('cleave'),
  name: 'Cleave',
  cost: 2,
  text: 'Deal 4 damage. Gain 2 block.',
};
