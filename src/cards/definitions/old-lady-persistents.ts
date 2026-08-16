/**
 * The Old Lady — persistent (ongoing) cards, authored in English.
 *
 * Her persistents mostly bend the two rules Power lives by: how you get it
 * (Sharpen and Fletching buy it with HP) and when you lose it (Explosives stops
 * the per-turn decay outright).
 *
 * Still to come, needing machinery the trigger grammar doesn't have yet:
 * Payback ("if you play a card that deals over 4 damage"), Arson ("the first
 * card you Add each turn is played twice") and Time Heals all Wounds ("when you
 * create a Blank card").
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

/** Every self-inflicted wound is worth a point of Power. */
export const SHARPEN: CardDef = {
  id: cardId('oldLady-sharpen'),
  name: 'Sharpen',
  cost: 1,
  text: 'When you lose HP, gain 1 power.',
};

export const CROSSWORD: CardDef = {
  id: cardId('oldLady-crossword'),
  name: 'Crossword',
  cost: 1,
  text: 'When you play a blank card, gain 1 energy.',
};

/** Turns Power from a per-turn burst into a stockpile. */
export const EXPLOSIVES: CardDef = {
  id: cardId('oldLady-explosives'),
  name: 'Explosives',
  cost: 1,
  text: 'Power no longer decreases at the start of your turn.',
};

export const FLETCHING: CardDef = {
  id: cardId('oldLady-fletching'),
  name: 'Fletching',
  cost: 1,
  text: 'At the start of your turn, lose 1 HP, gain 1 power.',
};

export const REVENGE: CardDef = {
  id: cardId('oldLady-revenge'),
  name: 'Revenge',
  cost: 1,
  text: 'When you add a card, deal 1 damage.',
};

export const OLD_LADY_PERSISTENTS: readonly CardDef[] = [
  SHARPEN,
  CROSSWORD,
  EXPLOSIVES,
  FLETCHING,
  REVENGE,
];
