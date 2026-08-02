/**
 * The Writer — works with Unplayable cards, "burning" them for effects, and
 * building Bravery to power a burst of block or damage (`reference/design.md`).
 *
 * The authored subset: everything expressible in the card language today.
 * Still to come (needing new machinery): Uncreative (a non-persistent card with
 * an ongoing trigger), Pull From the Hat (play a random card), Shredder (peek +
 * double an effect), Writing Prompt (random effect), Cheater (peek), and Well
 * Rested (next-turn effects).
 *
 * Design's em-dash convention maps to sentences here: "Find — Draw 2 — Deal 2
 * Damage" is authored as "Find 2 cards. If you find an unplayable card, deal 2
 * damage." — the rider fires when the Find turned up an Unplayable card.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

// --- attacks -----------------------------------------------------------------

export const PEN_STAB: CardDef = {
  id: cardId('writer-pen-stab'),
  name: 'Pen Stab',
  cost: 1,
  text: 'Deal 3 damage. Gain 1 energy.',
};

export const REFRAME: CardDef = {
  id: cardId('writer-reframe'),
  name: 'Reframe',
  cost: 1,
  text: 'Draw 2 cards. Deal 3 damage.',
};

export const DISPOSE: CardDef = {
  id: cardId('writer-dispose'),
  name: 'Dispose',
  cost: 1,
  text: 'Unplayable. Deal 4 damage.',
};

export const DUMPSTER_DIVER: CardDef = {
  id: cardId('writer-dumpster-diver'),
  name: 'Dumpster Diver',
  cost: 1,
  text: 'Burn 1. Deal 2 damage.',
};

export const TYPE: CardDef = {
  id: cardId('writer-type'),
  name: 'Type',
  cost: 1,
  text: 'Find 2 cards. If you find an unplayable card, deal 2 damage.',
};

export const JUNK: CardDef = {
  id: cardId('writer-junk'),
  name: 'Junk',
  cost: 1,
  text: 'Unplayable. Deal 1 damage to all opponents.',
};

export const RESCUE: CardDef = {
  id: cardId('writer-rescue'),
  name: 'Rescue',
  cost: 1,
  text: 'Gain 1 energy. Find 1 card. If you find an unplayable card, deal 3 damage.',
};

export const BRAIN_STORM: CardDef = {
  id: cardId('writer-brain-storm'),
  name: 'Brain Storm',
  cost: 1,
  text: 'Deal damage equal to your bravery. Set your bravery to zero.',
};

// --- skills ------------------------------------------------------------------

export const SEARCH: CardDef = {
  id: cardId('writer-search'),
  name: 'Search',
  cost: 1,
  text: 'Find 3 cards. If you find an unplayable card, gain 3 energy.',
};

export const QUILL: CardDef = {
  id: cardId('writer-quill'),
  name: 'Quill',
  cost: 1,
  text: 'Gain 4 shields. Gain 1 bravery.',
};

export const LOOK: CardDef = {
  id: cardId('writer-look'),
  name: 'Look',
  cost: 1,
  text: 'Find 2 cards. If you find an unplayable card, heal 3.',
};

export const NOTES: CardDef = {
  id: cardId('writer-notes'),
  name: 'Notes',
  cost: 1,
  text: 'Unplayable. Gain 2 shields.',
};

export const ROUGH_DRAFT: CardDef = {
  id: cardId('writer-rough-draft'),
  name: 'Rough Draft',
  cost: 1,
  text: 'Unplayable. Draw 1 card. Gain 1 bravery.',
};

export const TROPHY: CardDef = {
  id: cardId('writer-trophy'),
  name: 'Trophy',
  cost: 1,
  text: 'Burn 2. Heal 3.',
};

export const SCRIBBLE: CardDef = {
  id: cardId('writer-scribble'),
  name: 'Scribble',
  cost: 1,
  text: 'Unplayable. Gain 1 energy.',
};

export const WRITER_REFRESH: CardDef = {
  id: cardId('writer-refresh'),
  name: 'Refresh',
  cost: 1,
  text: 'Burn 3. Draw 3 cards.',
};

export const EVADE: CardDef = {
  id: cardId('writer-evade'),
  name: 'Evade',
  cost: 1,
  text: 'Burn 2. Gain 3 bravery.',
};

export const TRASH_CAN: CardDef = {
  id: cardId('writer-trash-can'),
  name: 'Trash Can',
  cost: 1,
  text: 'Add unplayable to 2 cards in your hand. Gain 1 energy.',
};

export const INSPIRATION: CardDef = {
  id: cardId('writer-inspiration'),
  name: 'Inspiration',
  cost: 1,
  text: 'Find 2 cards. If you find an unplayable card, burn all unplayable cards in your hand.',
};

export const STACK: CardDef = {
  id: cardId('writer-stack'),
  name: 'Stack',
  cost: 1,
  text: 'Find 1 card. If you find an unplayable card, draw 4 cards.',
};

export const WRITER_RESET: CardDef = {
  id: cardId('writer-reset'),
  name: 'Reset',
  cost: 1,
  text: 'Discard your hand. Find 3 cards. If you find an unplayable card, gain 2 energy.',
};

export const PLAYWRIGHT: CardDef = {
  id: cardId('writer-playwright'),
  name: 'Playwright',
  cost: 1,
  text: 'Burn 1. Gain 3 energy.',
};

export const GAMBLE_IT_ALL: CardDef = {
  id: cardId('writer-gamble-it-all'),
  name: 'Gamble it All',
  cost: 1,
  text: 'Find 1 card. If you find an unplayable card, gain 5 shields.',
};

export const PODCAST: CardDef = {
  id: cardId('writer-podcast'),
  name: 'Podcast',
  cost: 1,
  text: 'Gain 2 bravery. Gain 1 shield.',
};

export const MEMOIR: CardDef = {
  id: cardId('writer-memoir'),
  name: 'Memoir',
  cost: 1,
  text: 'Find 1 card. If you find an unplayable card, gain 4 bravery.',
};

/** The Writer's authored pool (persistents live in writer-persistents.ts). */
export const WRITER_CARDS: readonly CardDef[] = [
  PEN_STAB,
  REFRAME,
  DISPOSE,
  DUMPSTER_DIVER,
  TYPE,
  JUNK,
  RESCUE,
  BRAIN_STORM,
  SEARCH,
  QUILL,
  LOOK,
  NOTES,
  ROUGH_DRAFT,
  TROPHY,
  SCRIBBLE,
  WRITER_REFRESH,
  EVADE,
  TRASH_CAN,
  INSPIRATION,
  STACK,
  WRITER_RESET,
  PLAYWRIGHT,
  GAMBLE_IT_ALL,
  PODCAST,
  MEMOIR,
];
