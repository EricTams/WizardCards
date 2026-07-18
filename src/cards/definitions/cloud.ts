/**
 * The Cloud — card definitions.
 *
 * The Cloud creates smaller clouds (Lightning/Storm/Snow/Fog) that trigger small
 * effects at the start of its turn. This batch covers the cards expressible with
 * today's grammar (deal / heal / gain / draw / create clouds / remove clouds).
 * The per-turn cloud triggers themselves (gain energy per Lightning, etc.) need
 * the trigger system and land in a later pass — see `docs/roadmap.md`.
 *
 * Card ids are character-prefixed (`cloud-…`) so names that repeat across
 * characters (e.g. "Zap") still get unique ids.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const SUN_RAY: CardDef = {
  id: cardId('cloud-sun-ray'),
  name: 'Sun Ray',
  cost: 1,
  text: 'Deal 3 damage. Remove 1 cloud.',
};

export const CRISSCROSS: CardDef = {
  id: cardId('cloud-crisscross'),
  name: 'Crisscross',
  cost: 1,
  text: 'Deal 4 damage. Remove 1 cloud.',
};

export const CLOUD_ZAP: CardDef = {
  id: cardId('cloud-zap'),
  name: 'Zap',
  cost: 1,
  text: 'Deal 2 damage. Gain 1 energy.',
};

export const SHINE: CardDef = {
  id: cardId('cloud-shine'),
  name: 'Shine',
  cost: 1,
  text: 'Deal 6 damage. Remove 3 clouds.',
};

export const HURRICANE: CardDef = {
  id: cardId('cloud-hurricane'),
  name: 'Hurricane',
  cost: 1,
  text: 'Deal 3 damage. Create 2 storm clouds.',
};

export const CLEANSE: CardDef = {
  id: cardId('cloud-cleanse'),
  name: 'Cleanse',
  cost: 1,
  text: 'Heal 3. Remove 2 clouds.',
};

export const THUNDER: CardDef = {
  id: cardId('cloud-thunder'),
  name: 'Thunder',
  cost: 1,
  text: 'Create 1 lightning cloud.',
};

export const SPRINKLE: CardDef = {
  id: cardId('cloud-sprinkle'),
  name: 'Sprinkle',
  cost: 1,
  text: 'Gain 2 shields. Create 1 fog cloud.',
};

export const BREEZE: CardDef = {
  id: cardId('cloud-breeze'),
  name: 'Breeze',
  cost: 1,
  text: 'Gain 3 shields. Create 1 snow cloud.',
};

export const HAILSTORM: CardDef = {
  id: cardId('cloud-hailstorm'),
  name: 'Hailstorm',
  cost: 1,
  text: 'Create 1 snow cloud. Draw 1 card.',
};

export const HAZE: CardDef = {
  id: cardId('cloud-haze'),
  name: 'Haze',
  cost: 1,
  text: 'Draw 3 cards.',
};

export const RAIN: CardDef = {
  id: cardId('cloud-rain'),
  name: 'Rain',
  cost: 1,
  text: 'Gain 4 shields.',
};

export const CYCLONE: CardDef = {
  id: cardId('cloud-cyclone'),
  name: 'Cyclone',
  cost: 1,
  text: 'Create 1 storm cloud.',
};

export const TYPHOON: CardDef = {
  id: cardId('cloud-typhoon'),
  name: 'Typhoon',
  cost: 1,
  text: 'Create 2 storm clouds. Gain 1 energy.',
};

export const BOLT: CardDef = {
  id: cardId('cloud-bolt'),
  name: 'Bolt',
  cost: 1,
  text: 'Create 1 lightning cloud. Gain 1 energy.',
};

export const MIST: CardDef = {
  id: cardId('cloud-mist'),
  name: 'Mist',
  cost: 1,
  text: 'Create 1 fog cloud.',
};

export const TRICKLE: CardDef = {
  id: cardId('cloud-trickle'),
  name: 'Trickle',
  cost: 1,
  text: 'Create 1 storm cloud. Create 1 fog cloud.',
};

export const BLIZZARD: CardDef = {
  id: cardId('cloud-blizzard'),
  name: 'Blizzard',
  cost: 1,
  text: 'Create 1 snow cloud.',
};

export const ELECTROCUTE: CardDef = {
  id: cardId('cloud-electrocute'),
  name: 'Electrocute',
  cost: 1,
  text: 'Deal damage equal to your energy.',
};

export const SPIN: CardDef = {
  id: cardId('cloud-spin'),
  name: 'Spin',
  cost: 1,
  text: 'Deal 3 damage for each unique cloud.',
};

/** Every Cloud card in this batch, in table order. */
export const CLOUD_CARDS: readonly CardDef[] = [
  SUN_RAY,
  CRISSCROSS,
  CLOUD_ZAP,
  SHINE,
  HURRICANE,
  CLEANSE,
  THUNDER,
  SPRINKLE,
  BREEZE,
  HAILSTORM,
  HAZE,
  RAIN,
  CYCLONE,
  TYPHOON,
  BOLT,
  MIST,
  TRICKLE,
  BLIZZARD,
  ELECTROCUTE,
  SPIN,
];
