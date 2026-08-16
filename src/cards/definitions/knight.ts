/**
 * The Knight — card definitions.
 *
 * The Knight's deck doesn't do things directly; it *prepares* the cards you are
 * about to play. **Markings** are per-copy stickers with a value, and a marked
 * card fires its markings when it is played and then loses them
 * (`reference/design.md` → Knight):
 *
 *   Sharp N    → deal N damage to a random enemy
 *   Sturdy N   → draw N cards
 *   Flaming N  → gain N energy
 *   Safe N     → heal N
 *
 * The Knight is the newest character in the design and has **no art yet** — its
 * cards render as their tinted panel plus the HTML name/cost tags, and it is
 * marked unplayable in `content.ts` until the faces exist.
 *
 * This batch is the subset expressible with today's grammar. Most of what's
 * missing needs a card to read or change *its own* markings (Invade, Spike Pit,
 * Battle Wound, Sharper), to mark cards as they are drawn (Cindering, Solid
 * Gold), or to arm a future play (Blades, Blinding, Blockade, Carve, Secure) —
 * see `docs/roadmap.md`.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

// --- attacks -----------------------------------------------------------------

export const CATAPULT: CardDef = {
  id: cardId('knight-catapult'),
  name: 'Catapult',
  cost: 1,
  text: 'Deal 4 damage. Draw 1 card.',
};

export const JOUST_LOPY: CardDef = {
  id: cardId('knight-joust-lopy'),
  name: 'Joust-lopy',
  cost: 1,
  text: 'Deal 2 damage. Gain 1 energy.',
};

export const ARMORY: CardDef = {
  id: cardId('knight-armory'),
  name: 'Armory',
  cost: 1,
  text: 'Deal 3 damage. Draw 2 cards.',
};

export const DYNAMITE: CardDef = {
  id: cardId('knight-dynamite'),
  name: 'Dynamite',
  cost: 1,
  text: 'Deal 3 damage. Mark 2 cards in your hand with sharp 2.',
};

export const CHIVALRY: CardDef = {
  id: cardId('knight-chivalry'),
  name: 'Chivalry',
  cost: 1,
  text: 'Deal 3 damage. Mark 1 card in your hand with sturdy 1.',
};

export const MATCHES: CardDef = {
  id: cardId('knight-matches'),
  name: 'Matches',
  cost: 1,
  text: 'Deal 3 damage. Mark 1 random card in your hand with flaming 1.',
};

export const TAKE_SHELTER: CardDef = {
  id: cardId('knight-take-shelter'),
  name: 'Take Shelter',
  cost: 1,
  text: 'Deal 3 damage. Mark 1 card in your hand with safe 2.',
};

export const DRAWBRIDGE: CardDef = {
  id: cardId('knight-drawbridge'),
  name: 'Drawbridge',
  cost: 1,
  text: 'Deal 3 damage. Mark 2 cards in your hand with safe 1.',
};

// --- skills ------------------------------------------------------------------

/** The whole hand becomes a volley — every card you play this turn bites. */
export const PROTECT: CardDef = {
  id: cardId('knight-protect'),
  name: 'Protect',
  cost: 1,
  text: 'Gain 3 shields. Mark all cards in your hand with sharp 1.',
};

export const BEHEAD: CardDef = {
  id: cardId('knight-behead'),
  name: 'Behead',
  cost: 1,
  text: 'Mark 2 cards in your hand with sharp 2.',
};

export const RANGE: CardDef = {
  id: cardId('knight-range'),
  name: 'Range',
  cost: 1,
  text: 'Gain 4 shields. Mark 1 card in your hand with sturdy 3.',
};

/** Two markings on one card: it draws, and it pays for the next play. */
export const SNAP: CardDef = {
  id: cardId('knight-snap'),
  name: 'Snap',
  cost: 1,
  text: 'Mark 1 card in your hand with sturdy 2. Mark 1 card in your hand with flaming 1.',
};

export const TORCH: CardDef = {
  id: cardId('knight-torch'),
  name: 'Torch',
  cost: 1,
  text: 'Gain 1 energy. Mark 1 card in your hand with flaming 1.',
};

export const CHAIN_MAIL: CardDef = {
  id: cardId('knight-chain-mail'),
  name: 'Chain Mail',
  cost: 1,
  text: 'Draw 1 card. Mark 1 card in your hand with flaming 2.',
};

/** Wipes the slate, then puts one big marking back on it. */
export const PLATE: CardDef = {
  id: cardId('knight-plate'),
  name: 'Plate',
  cost: 1,
  text: 'Remove all markings. Mark 1 card in your hand with flaming 3.',
};

export const HEALING_POTION: CardDef = {
  id: cardId('knight-healing-potion'),
  name: 'Healing Potion',
  cost: 1,
  text: 'Heal 2. Mark 1 card in your hand with safe 3.',
};

export const LUMBER: CardDef = {
  id: cardId('knight-lumber'),
  name: 'Lumber',
  cost: 1,
  text: 'Draw 2 cards. Gain 1 energy.',
};

export const CHISEL: CardDef = {
  id: cardId('knight-chisel'),
  name: 'Chisel',
  cost: 1,
  text: 'Mark 1 card in your hand with a random marking 3.',
};

export const HELMET: CardDef = {
  id: cardId('knight-helmet'),
  name: 'Helmet',
  cost: 1,
  text: 'Gain 6 shields.',
};

/** The pool a Knight deck is drawn from. */
export const KNIGHT_CARDS: readonly CardDef[] = [
  CATAPULT,
  JOUST_LOPY,
  ARMORY,
  DYNAMITE,
  CHIVALRY,
  MATCHES,
  TAKE_SHELTER,
  DRAWBRIDGE,
  PROTECT,
  BEHEAD,
  RANGE,
  SNAP,
  TORCH,
  CHAIN_MAIL,
  PLATE,
  HEALING_POTION,
  LUMBER,
  CHISEL,
  HELMET,
];
