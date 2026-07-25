/**
 * The Crab — card definitions.
 *
 * The Crab turns discarding from a cost into an engine: its cards carry **Claw**
 * ("whenever this card is discarded, it plays for free"), so the cards that make
 * you discard and the cards that reward being discarded are the same deck. Where
 * the Cloud builds a board of clouds, the Crab churns its hand.
 *
 * This batch is the subset expressible with today's grammar (deal / heal / gain /
 * draw / discard cards / Claw / scaling off cards discarded this turn), matching
 * how the Cloud and Wizard pools shipped. The rest of the designed 40 need
 * machinery that doesn't exist yet — choosing a card from hand, moving cards
 * between piles, replaying a card, granting Claw to another card — see
 * `docs/roadmap.md`.
 *
 * Card ids are character-prefixed (`crab-…`) so names that repeat across
 * characters (e.g. "Refresh") still get unique ids. Costs are all 1 for now,
 * as with the other two characters.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

// --- attacks -----------------------------------------------------------------

export const LITTLE_SPLASH: CardDef = {
  id: cardId('crab-little-splash'),
  name: 'Little Splash',
  cost: 1,
  text: 'Deal 8 damage.',
};

export const PINCH: CardDef = {
  id: cardId('crab-pinch'),
  name: 'Pinch',
  cost: 1,
  text: 'Claw. Deal 4 damage.',
};

export const QUICKSAND: CardDef = {
  id: cardId('crab-quicksand'),
  name: 'Quicksand',
  cost: 1,
  text: 'Discard 1 card. Deal 2 damage.',
};

export const BLEND_IN: CardDef = {
  id: cardId('crab-blend-in'),
  name: 'Blend In',
  cost: 1,
  text: 'Deal 4 damage. Gain 2 shields.',
};

/** The Crab's payoff card: the more you've churned this turn, the harder it hits. */
export const LOCATOR: CardDef = {
  id: cardId('crab-locator'),
  name: 'Locator',
  cost: 1,
  text: 'Claw. Deal 1 damage for each card discarded this turn.',
};

export const SWIPE: CardDef = {
  id: cardId('crab-swipe'),
  name: 'Swipe',
  cost: 1,
  text: 'Claw. Draw 2 cards. Deal 6 damage.',
};

// --- skills ------------------------------------------------------------------

export const HERMIT: CardDef = {
  id: cardId('crab-hermit'),
  name: 'Hermit',
  cost: 1,
  text: 'Claw. Heal 2. Discard 1 card.',
};

export const STEAMROLL: CardDef = {
  id: cardId('crab-steamroll'),
  name: 'Steamroll',
  cost: 1,
  text: 'Gain 2 shields. Draw 1 card. Discard 1 card.',
};

export const SNIP: CardDef = {
  id: cardId('crab-snip'),
  name: 'Snip',
  cost: 1,
  text: 'Draw 2 cards.',
};

export const WATERSPOUT: CardDef = {
  id: cardId('crab-waterspout'),
  name: 'Waterspout',
  cost: 1,
  text: 'Heal 1. Draw 1 card. Discard 1 card.',
};

export const GLACIAL_MELT: CardDef = {
  id: cardId('crab-glacial-melt'),
  name: 'Glacial Melt',
  cost: 1,
  text: 'Claw. Draw 1 card. Gain 1 energy.',
};

export const HOOK: CardDef = {
  id: cardId('crab-hook'),
  name: 'Hook',
  cost: 1,
  text: 'Claw. Gain 2 energy.',
};

export const ECDYCIS: CardDef = {
  id: cardId('crab-ecdycis'),
  name: 'Ecdycis',
  cost: 1,
  text: 'Draw 3 cards.',
};

export const DOUBLE_DRAW: CardDef = {
  id: cardId('crab-double-draw'),
  name: 'Double Draw',
  cost: 1,
  text: 'Draw 2 cards. Discard 2 cards.',
};

export const SANDBED: CardDef = {
  id: cardId('crab-sandbed'),
  name: 'Sandbed',
  cost: 1,
  text: 'Heal 1. Gain 4 shields.',
};

export const AN_ENEMY: CardDef = {
  id: cardId('crab-an-enemy'),
  name: 'An-Enemy',
  cost: 1,
  text: 'Gain 1 shield. Gain 1 energy.',
};

export const BOIL: CardDef = {
  id: cardId('crab-boil'),
  name: 'Boil',
  cost: 1,
  text: 'Gain 1 energy. Discard 3 cards.',
};

export const PICKLE_PAL: CardDef = {
  id: cardId('crab-pickle-pal'),
  name: 'Pickle Pal',
  cost: 1,
  text: 'Claw. Gain 5 shields.',
};

export const ONE_FINGER_TOUCH: CardDef = {
  id: cardId('crab-one-finger-touch'),
  name: 'One Finger Touch',
  cost: 1,
  text: 'Draw 3 cards. Discard 1 card.',
};

export const LOW_TIDE: CardDef = {
  id: cardId('crab-low-tide'),
  name: 'Low Tide',
  cost: 1,
  text: 'Claw. Heal 1. Draw 1 card.',
};

/** The pool a Crab deck is drawn from. */
export const CRAB_CARDS: readonly CardDef[] = [
  LITTLE_SPLASH,
  PINCH,
  QUICKSAND,
  BLEND_IN,
  LOCATOR,
  SWIPE,
  HERMIT,
  STEAMROLL,
  SNIP,
  WATERSPOUT,
  GLACIAL_MELT,
  HOOK,
  ECDYCIS,
  DOUBLE_DRAW,
  SANDBED,
  AN_ENEMY,
  BOIL,
  PICKLE_PAL,
  ONE_FINGER_TOUCH,
  LOW_TIDE,
];
