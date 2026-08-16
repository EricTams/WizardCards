/**
 * The Writer — card definitions.
 *
 * The Writer banks **Craft** and spends it on **Burn** cards, which cost Craft
 * instead of energy: the deck is an economy of building up and cashing in.
 * **Fading** cards are worth more the turn you draw them (they leave your hand
 * at end of turn either way), and **Bravery** turns one block card a turn into
 * a burst. See `reference/design.md` → The Writer.
 *
 * This batch is the subset expressible with today's grammar. Still to come,
 * needing machinery the language doesn't have yet:
 *   - Uncreative, Rough Draft, Writing Prompt, Stack — "when you play a card
 *     this turn, …" riders that arm a *future* play.
 *   - Inspiration, Reset — playing or filtering cards out of a draw.
 *   - Shake Spear, Direct, Paper Trail, Ask AI, Editor, Scribe — persistents
 *     keying off events the trigger grammar has no name for yet (playing a
 *     Fading card, drawing a Burn card, "additional" draws).
 * See `docs/roadmap.md`.
 *
 * Card ids are character-prefixed (`writer-…`) so names that repeat across
 * characters (e.g. "Refresh") still get unique ids.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

// --- attacks -----------------------------------------------------------------

export const PEN_STAB: CardDef = {
  id: cardId('writer-pen-stab'),
  name: 'Pen Stab',
  cost: 1,
  text: 'Deal 3 damage. Craft 2.',
};

export const REFRAME: CardDef = {
  id: cardId('writer-reframe'),
  name: 'Reframe',
  cost: 1,
  text: 'Fading. Deal 1 damage. Craft 3.',
};

export const DISPOSE: CardDef = {
  id: cardId('writer-dispose'),
  name: 'Dispose',
  cost: 1,
  text: 'Deal 4 damage. Draw 3 cards.',
};

/** The whole bank, at once: everything you have saved becomes damage. */
export const DUMPSTER_DIVER: CardDef = {
  id: cardId('writer-dumpster-diver'),
  name: 'Dumpster Diver',
  cost: 1,
  text: 'Burn all. Deal damage equal to the craft burned.',
};

export const TYPE: CardDef = {
  id: cardId('writer-type'),
  name: 'Type',
  cost: 1,
  text: 'Fading. Burn 3. Deal 5 damage.',
};

export const JUNK: CardDef = {
  id: cardId('writer-junk'),
  name: 'Junk',
  cost: 1,
  text: 'Deal 2 damage. Craft 1. Gain 2 bravery.',
};

export const RESCUE: CardDef = {
  id: cardId('writer-rescue'),
  name: 'Rescue',
  cost: 1,
  text: 'Burn 5. Draw 2 cards. Deal 6 damage.',
};

export const BRAIN_STORM: CardDef = {
  id: cardId('writer-brain-storm'),
  name: 'Brain Storm',
  cost: 1,
  text: 'Deal damage equal to your bravery. Set your bravery to zero.',
};

export const SEARCH: CardDef = {
  id: cardId('writer-search'),
  name: 'Search',
  cost: 1,
  text: 'Deal 4 damage. Gain 1 energy. Add fading to 1 card in your hand.',
};

// --- skills ------------------------------------------------------------------

export const QUILL: CardDef = {
  id: cardId('writer-quill'),
  name: 'Quill',
  cost: 1,
  text: 'Fading. Gain 1 shield. Craft 2.',
};

export const LOOK: CardDef = {
  id: cardId('writer-look'),
  name: 'Look',
  cost: 1,
  text: 'Craft 3. Gain 3 bravery.',
};

/**
 * Design reads "Craft equal to the Shields gained from this card" — authored as
 * the flat 2 it gains, since a Bravery-boosted shield would otherwise let one
 * card's Craft swing with a resource it doesn't mention.
 */
export const NOTES: CardDef = {
  id: cardId('writer-notes'),
  name: 'Notes',
  cost: 1,
  text: 'Gain 2 shields. Craft 2.',
};

export const TROPHY: CardDef = {
  id: cardId('writer-trophy'),
  name: 'Trophy',
  cost: 1,
  text: 'Next turn, gain 2 shields, craft 3.',
};

export const SCRIBBLE: CardDef = {
  id: cardId('writer-scribble'),
  name: 'Scribble',
  cost: 1,
  text: 'Burn 1. Gain 3 shields.',
};

export const WRITER_REFRESH: CardDef = {
  id: cardId('writer-refresh'),
  name: 'Refresh',
  cost: 1,
  text: 'Burn 2. Gain 2 energy. Draw 1 card.',
};

export const EVADE: CardDef = {
  id: cardId('writer-evade'),
  name: 'Evade',
  cost: 1,
  text: 'Burn 3. Gain 1 bravery for each fading card in your hand.',
};

export const TRASH_CAN: CardDef = {
  id: cardId('writer-trash-can'),
  name: 'Trash Can',
  cost: 1,
  text: 'Fading. Burn 4. Heal 4.',
};

/** The bank's best rate: five Craft in, eight back out. */
export const PULL_FROM_THE_HAT: CardDef = {
  id: cardId('writer-pull-from-the-hat'),
  name: 'Pull From the Hat',
  cost: 1,
  text: 'Burn 5. Craft 8.',
};

export const SHREDDER: CardDef = {
  id: cardId('writer-shredder'),
  name: 'Shredder',
  cost: 1,
  text: 'Fading. Gain 3 energy.',
};

export const PLAYWRIGHT: CardDef = {
  id: cardId('writer-playwright'),
  name: 'Playwright',
  cost: 1,
  text: 'Burn 2. Gain 4 shields.',
};

/** All in: your armor becomes a bigger Bravery burst, or nothing at all. */
export const GAMBLE_IT_ALL: CardDef = {
  id: cardId('writer-gamble-it-all'),
  name: 'Gamble it All',
  cost: 1,
  text: 'Double your bravery. Lose all defense.',
};

export const CHEATER: CardDef = {
  id: cardId('writer-cheater'),
  name: 'Cheater',
  cost: 1,
  text: 'Gain bravery equal to your defense. Set your defense to zero.',
};

export const PODCAST: CardDef = {
  id: cardId('writer-podcast'),
  name: 'Podcast',
  cost: 1,
  text: 'Gain 2 bravery. Gain 1 shield.',
};

export const WELL_RESTED: CardDef = {
  id: cardId('writer-well-rested'),
  name: 'Well Rested',
  cost: 1,
  text: 'Next turn, gain 1 bravery, gain 1 energy.',
};

export const MEMOIR: CardDef = {
  id: cardId('writer-memoir'),
  name: 'Memoir',
  cost: 1,
  text: 'Gain 4 shields. Gain 1 bravery.',
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
  TROPHY,
  SCRIBBLE,
  WRITER_REFRESH,
  EVADE,
  TRASH_CAN,
  PULL_FROM_THE_HAT,
  SHREDDER,
  PLAYWRIGHT,
  GAMBLE_IT_ALL,
  CHEATER,
  PODCAST,
  WELL_RESTED,
  MEMOIR,
];
