/**
 * The Wizard — card definitions.
 *
 * The Wizard stores an X-value as Poison and spends it with Venom (deal damage =
 * Poison, then zero it) and Drink (gain block = Poison, then zero it). This batch
 * covers the cards expressible today, including the Poison keyword mechanics and
 * basic Minion summoning.
 *
 * Deferred to the trigger pass (see `docs/roadmap.md`): a Minion *replaying* its
 * effect at the start of your turn, and taking damage in place of you. Today
 * `Minion.` summons a copy of the card and its other effects still run on play,
 * matching "whenever first played, play the card".
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const WIZARD_ZAP: CardDef = {
  id: cardId('wizard-zap'),
  name: 'Zap',
  cost: 1,
  text: 'Deal 2 damage. Draw 1 card.',
};

export const STUN: CardDef = {
  id: cardId('wizard-stun'),
  name: 'Stun',
  cost: 1,
  text: 'Deal 3 damage.',
};

export const BARREL_ROLL: CardDef = {
  id: cardId('wizard-barrel-roll'),
  name: 'Barrel Roll',
  cost: 1,
  text: 'Deal 5 damage. Poison 2.',
};

export const SLICE: CardDef = {
  id: cardId('wizard-slice'),
  name: 'Slice',
  cost: 1,
  text: 'Deal 4 damage. Gain 1 energy.',
};

export const HOSTILE: CardDef = {
  id: cardId('wizard-hostile'),
  name: 'Hostile',
  cost: 1,
  text: 'Venom. Drink.',
};

export const SEEK: CardDef = {
  id: cardId('wizard-seek'),
  name: 'Seek',
  cost: 1,
  text: 'Venom. Gain 1 energy.',
};

export const POUR: CardDef = {
  id: cardId('wizard-pour'),
  name: 'Pour',
  cost: 1,
  text: 'Venom. Gain 3 shields.',
};

export const CURSE: CardDef = {
  id: cardId('wizard-curse'),
  name: 'Curse',
  cost: 1,
  text: 'Poison 5.',
};

export const BAKE: CardDef = {
  id: cardId('wizard-bake'),
  name: 'Bake',
  cost: 1,
  text: 'Heal 4. Poison 3.',
};

export const FUEL: CardDef = {
  id: cardId('wizard-fuel'),
  name: 'Fuel',
  cost: 1,
  text: 'Poison 3. Drink.',
};

export const NOBODY_HOME: CardDef = {
  id: cardId('wizard-nobody-home'),
  name: 'Nobody Home',
  cost: 1,
  text: 'Gain 4 shields. Gain 1 energy.',
};

export const SAFETY_SPELL: CardDef = {
  id: cardId('wizard-safety-spell'),
  name: 'Safety Spell',
  cost: 1,
  text: 'Draw 1 card. Heal 2.',
};

export const SHOCK: CardDef = {
  id: cardId('wizard-shock'),
  name: 'Shock',
  cost: 1,
  text: 'Gain 2 energy.',
};

export const CAULDRON: CardDef = {
  id: cardId('wizard-cauldron'),
  name: 'Cauldron',
  cost: 1,
  text: 'Gain 5 shields.',
};

export const ACIDIC: CardDef = {
  id: cardId('wizard-acidic'),
  name: 'Acidic',
  cost: 1,
  text: 'Poison 3. Gain 2 energy.',
};

export const MIXTURE: CardDef = {
  id: cardId('wizard-mixture'),
  name: 'Mixture',
  cost: 1,
  text: 'Poison 2. Gain 4 shields.',
};

export const THROW: CardDef = {
  id: cardId('wizard-throw'),
  name: 'Throw',
  cost: 1,
  text: 'Deal 8 damage. Discard 1 minion.',
};

export const POISON_SPILL: CardDef = {
  id: cardId('wizard-poison-spill'),
  name: 'Poison Spill',
  cost: 1,
  text: 'Minion. Venom.',
};

export const ALCHEMY: CardDef = {
  id: cardId('wizard-alchemy'),
  name: 'Alchemy',
  cost: 1,
  text: 'Minion. Poison 1.',
};

export const CRYSTAL_BALL: CardDef = {
  id: cardId('wizard-crystal-ball'),
  name: 'Crystal Ball',
  cost: 1,
  text: 'Deal 1 damage for each minion.',
};

export const HURL: CardDef = {
  id: cardId('wizard-hurl'),
  name: 'Hurl',
  cost: 1,
  text: 'Discard 2 minions. Deal damage equal to your defense.',
};

export const ELECTRIC: CardDef = {
  id: cardId('wizard-electric'),
  name: 'Electric',
  cost: 1,
  text: 'Draw 2 cards. Gain 1 energy.',
};

export const MIND_READ: CardDef = {
  id: cardId('wizard-mind-read'),
  name: 'Mind Read',
  cost: 1,
  text: 'Drink. Deal 3 damage.',
};

/** "Drink Twice" — two Drink statements, since each spends the poison in turn. */
export const SQUID_MODE: CardDef = {
  id: cardId('wizard-squid-mode'),
  name: 'Squid Mode',
  cost: 1,
  text: 'Drink. Drink. Gain 1 energy.',
};

export const UNFRIENDLY: CardDef = {
  id: cardId('wizard-unfriendly'),
  name: 'Unfriendly',
  cost: 1,
  text: 'Draw 4 cards. Discard 1 minion.',
};

export const BATTERY: CardDef = {
  id: cardId('wizard-battery'),
  name: 'Battery',
  cost: 1,
  text: 'Minion. Gain 1 energy.',
};

export const DELIVERY: CardDef = {
  id: cardId('wizard-delivery'),
  name: 'Delivery',
  cost: 1,
  text: 'Minion. Draw 1 card.',
};

/** Every Wizard card in this batch, in table order. */
export const WIZARD_CARDS: readonly CardDef[] = [
  WIZARD_ZAP,
  STUN,
  BARREL_ROLL,
  SLICE,
  HOSTILE,
  SEEK,
  POUR,
  CURSE,
  BAKE,
  FUEL,
  NOBODY_HOME,
  SAFETY_SPELL,
  SHOCK,
  CAULDRON,
  ACIDIC,
  MIXTURE,
  THROW,
  POISON_SPILL,
  ALCHEMY,
  CRYSTAL_BALL,
  HURL,
  ELECTRIC,
  MIND_READ,
  SQUID_MODE,
  UNFRIENDLY,
  BATTERY,
  DELIVERY,
];
