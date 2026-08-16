/**
 * The Knight — persistent (ongoing) cards, authored in English.
 *
 * These are the Marking payoffs: they turn "a card that happened to be marked"
 * into a second reward, on top of the marking's own effect.
 *
 * Still to come, needing machinery the trigger grammar doesn't have yet: Sculpt
 * ("2 or more unique markings"), Whittling ("every 4th card"), Reshape (raising
 * a marking's value), Cannonball ("the first time you draw an additional card")
 * and Figurine (re-rolling marking types at the start of your turn).
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const ENGRAVE: CardDef = {
  id: cardId('knight-engrave'),
  name: 'Engrave',
  cost: 1,
  text: 'When you play a card marked with sharp, gain 1 shield.',
};

export const ETCHING: CardDef = {
  id: cardId('knight-etching'),
  name: 'Etching',
  cost: 1,
  text: 'When you play a card marked with sturdy, draw 1 card.',
};

export const WOODWORKING: CardDef = {
  id: cardId('knight-woodworking'),
  name: 'Woodworking',
  cost: 1,
  text: 'When you play a card marked with safe, deal 2 damage to a random opponent.',
};

export const KNIGHT_PERSISTENTS: readonly CardDef[] = [ENGRAVE, ETCHING, WOODWORKING];
