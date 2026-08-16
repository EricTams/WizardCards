/**
 * The Old Lady — card definitions.
 *
 * "The Lowest Attacks of any character, but makes up for it by increasing
 * damage dealt." Her deck is built around three things (`reference/design.md`):
 *
 *   - **Power** — the FIRST attack each turn deals this much extra. It decays a
 *     point per turn, so it wants spending, and much of the pool buys it with HP.
 *   - **Blank** — a card with no effects whose only job is to open the window.
 *   - **Add** — cards that can't be played at all until a Blank opens that
 *     window, and are then free. A Blank card plus a fistful of Adds is a turn.
 *
 * This batch is the subset expressible with today's grammar. Still to come:
 * Papier Machette and Disguise (creating copies of a Blank card), and the
 * persistents Payback ("a card that deals over 4 damage"), Arson ("the first
 * card you Add each turn is played twice") and Time Heals all Wounds ("when you
 * create a Blank card") — see `docs/roadmap.md`.
 *
 * Card names match the art files exactly (`Old Lady Cards-<name>.png`), which is
 * why card 32 is "Retirement" rather than the rulebook's "Retirement Plan".
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

// --- attacks -----------------------------------------------------------------

export const SHARP_STRIKE: CardDef = {
  id: cardId('oldLady-sharp-strike'),
  name: 'Sharp Strike',
  cost: 1,
  text: 'Deal 1 damage. Gain 1 energy.',
};

export const SMOKE_BOMB: CardDef = {
  id: cardId('oldLady-smoke-bomb'),
  name: 'Smoke Bomb',
  cost: 1,
  text: 'Gain 4 shields. Deal 3 damage. Gain 2 power. Lose 1 HP.',
};

export const EVIL_GLARE: CardDef = {
  id: cardId('oldLady-evil-glare'),
  name: 'Evil Glare',
  cost: 1,
  text: 'Deal 5 damage. Lose 1 HP.',
};

export const SWORDS_AT_THE_READY: CardDef = {
  id: cardId('oldLady-swords-at-the-ready'),
  name: 'Swords at the Ready',
  cost: 1,
  text: 'Add. Deal 2 damage.',
};

/** Spends the buff to hit harder now — the trade the whole deck is about. */
export const SIMPLE_SLASH: CardDef = {
  id: cardId('oldLady-simple-slash'),
  name: 'Simple Slash',
  cost: 1,
  text: 'Deal 4 damage. Lose 1 power.',
};

/** The Add payoff: the more you crammed into this window, the harder it lands. */
export const PRUNES: CardDef = {
  id: cardId('oldLady-prunes'),
  name: 'Prunes',
  cost: 1,
  text: 'Add. Deal 1 damage for each card added.',
};

/** Design reads "gain Shields equal to damage dealt" — its own 3, authored flat. */
export const ESCAPE_PLAN: CardDef = {
  id: cardId('oldLady-escape-plan'),
  name: 'Escape Plan',
  cost: 1,
  text: 'Deal 3 damage. Gain 3 shields.',
};

// --- the Blank cards ---------------------------------------------------------
// No effects at all. Playing one opens the Add window: every Add card in hand
// becomes free until you play something that is neither Add nor Blank.

export const PAPER: CardDef = {
  id: cardId('oldLady-paper'),
  name: 'Paper',
  cost: 1,
  text: 'Blank.',
};

export const BLANK_SLATE: CardDef = {
  id: cardId('oldLady-blank-slate'),
  name: 'Blank Slate',
  cost: 1,
  text: 'Blank.',
};

export const AIR: CardDef = {
  id: cardId('oldLady-air'),
  name: 'Air',
  cost: 1,
  text: 'Blank.',
};

export const MYSTERY: CardDef = {
  id: cardId('oldLady-mystery'),
  name: 'Mystery',
  cost: 1,
  text: 'Blank.',
};

// --- the Add cards -----------------------------------------------------------

export const BUCKET_LIST: CardDef = {
  id: cardId('oldLady-bucket-list'),
  name: 'Bucket List',
  cost: 1,
  text: 'Add. Draw 1 card. Heal 2.',
};

export const HEALTHINESS: CardDef = {
  id: cardId('oldLady-healthiness'),
  name: 'Healthiness',
  cost: 1,
  text: 'Add. Heal 1.',
};

export const PREPARATION: CardDef = {
  id: cardId('oldLady-preparation'),
  name: 'Preparation',
  cost: 1,
  text: 'Add. Gain 1 energy.',
};

export const CHASE_DOWN: CardDef = {
  id: cardId('oldLady-chase-down'),
  name: 'Chase Down',
  cost: 1,
  text: 'Add. Draw 1 card.',
};

export const CROSSING_GUARD: CardDef = {
  id: cardId('oldLady-crossing-guard'),
  name: 'Crossing Guard',
  cost: 1,
  text: 'Add. Lose 2 HP. Gain 6 shields.',
};

export const SCARE: CardDef = {
  id: cardId('oldLady-scare'),
  name: 'Scare',
  cost: 1,
  text: 'Add. Lose 1 HP. Gain 1 energy.',
};

export const VIOLENT: CardDef = {
  id: cardId('oldLady-violent'),
  name: 'Violent',
  cost: 1,
  text: 'Add. Gain 3 power.',
};

export const DESTROY: CardDef = {
  id: cardId('oldLady-destroy'),
  name: 'Destroy',
  cost: 1,
  text: 'Add. Lose 3 HP. Next turn, gain 2 power.',
};

export const FRUIT_JUICE: CardDef = {
  id: cardId('oldLady-fruit-juice'),
  name: 'Fruit Juice',
  cost: 1,
  text: 'Add. Heal 5.',
};

// --- everything else ---------------------------------------------------------

export const INTIMIDATE: CardDef = {
  id: cardId('oldLady-intimidate'),
  name: 'Intimidate',
  cost: 1,
  text: 'Gain 2 power. Gain 3 shields.',
};

export const COLLECTION: CardDef = {
  id: cardId('oldLady-collection'),
  name: 'Collection',
  cost: 1,
  text: 'Draw 2 cards. Heal 1.',
};

export const BUTCHER: CardDef = {
  id: cardId('oldLady-butcher'),
  name: 'Butcher',
  cost: 1,
  text: 'Gain 3 energy. Lose 1 HP.',
};

export const FEAR: CardDef = {
  id: cardId('oldLady-fear'),
  name: 'Fear',
  cost: 1,
  text: 'Gain 2 power. Gain 2 shields.',
};

export const REST: CardDef = {
  id: cardId('oldLady-rest'),
  name: 'Rest',
  cost: 1,
  text: 'Heal 2. Gain 1 energy.',
};

/** Arms the whole table — but you get the bigger share. */
export const CHALLENGE: CardDef = {
  id: cardId('oldLady-challenge'),
  name: 'Challenge',
  cost: 1,
  text: 'Gain 3 power. Gain 1 power to all opponents.',
};

export const DASH: CardDef = {
  id: cardId('oldLady-dash'),
  name: 'Dash',
  cost: 1,
  text: 'Gain 1 power for each blank card in your hand.',
};

/** Cash the buff in as HP instead of damage, when the turn has gone badly. */
export const MEND: CardDef = {
  id: cardId('oldLady-mend'),
  name: 'Mend',
  cost: 1,
  text: 'Gain 1 energy. Lose all power, heal equal to the power lost.',
};

/**
 * Design reads "Everyone gains 6 Shields" — authored as the caster's half only,
 * since handing the opponent shields needs an all-targets resource gain the
 * language doesn't have yet.
 */
export const MIND_GAMES: CardDef = {
  id: cardId('oldLady-mind-games'),
  name: 'Mind Games',
  cost: 1,
  text: 'Gain 6 shields. Next turn, gain 5 power.',
};

export const RETIREMENT: CardDef = {
  id: cardId('oldLady-retirement'),
  name: 'Retirement',
  cost: 1,
  text: 'Lose 2 power. Put add on 1 card in your hand.',
};

/** The pool an Old Lady deck is drawn from. */
export const OLD_LADY_CARDS: readonly CardDef[] = [
  SHARP_STRIKE,
  SMOKE_BOMB,
  EVIL_GLARE,
  SWORDS_AT_THE_READY,
  SIMPLE_SLASH,
  PRUNES,
  ESCAPE_PLAN,
  PAPER,
  BLANK_SLATE,
  AIR,
  MYSTERY,
  BUCKET_LIST,
  HEALTHINESS,
  PREPARATION,
  CHASE_DOWN,
  CROSSING_GUARD,
  SCARE,
  VIOLENT,
  DESTROY,
  FRUIT_JUICE,
  INTIMIDATE,
  COLLECTION,
  BUTCHER,
  FEAR,
  REST,
  CHALLENGE,
  DASH,
  MEND,
  MIND_GAMES,
  RETIREMENT,
];
