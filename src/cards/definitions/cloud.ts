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

export const DRAW_LATER: CardDef = {
  id: cardId('cloud-draw-later'),
  name: 'Draw Later',
  cost: 1,
  text: 'Draw 1 card. Create 2 fog clouds.',
};

export const DRAW_NOW: CardDef = {
  id: cardId('cloud-draw-now'),
  name: 'Draw Now',
  cost: 1,
  text: 'Draw 2 cards. Create 1 fog cloud.',
};

export const EMPTY_OUT: CardDef = {
  id: cardId('cloud-empty-out'),
  name: 'Empty Out',
  cost: 1,
  text: 'Heal 1. Remove 3 clouds.',
};

export const SPARK: CardDef = {
  id: cardId('cloud-spark'),
  name: 'Spark',
  cost: 1,
  text: 'Gain 3 energy. Remove 3 clouds.',
};

export const CLEAR: CardDef = {
  id: cardId('cloud-clear'),
  name: 'Clear',
  cost: 1,
  text: 'Remove 1 cloud. Create 2 fog clouds.',
};

export const FINAL_SHOCK: CardDef = {
  id: cardId('cloud-final-shock'),
  name: 'Final Shock',
  cost: 1,
  text: 'Create 3 lightning clouds.',
};

export const OUTBURST: CardDef = {
  id: cardId('cloud-outburst'),
  name: 'Outburst',
  cost: 1,
  text: 'Create 1 storm cloud. Increase max clouds by 1.',
};

export const SPATIAL_REASONING: CardDef = {
  id: cardId('cloud-spatial-reasoning'),
  name: 'Spatial Reasoning',
  cost: 1,
  text: 'Remove 3 clouds. Increase max clouds by 1.',
};

/**
 * Designed as "remove all clouds, deal 2 damage for each cloud removed". The
 * statements are ordered damage-first because the scale reads your cloud count
 * at reduce time: counting before the wipe gives exactly "each cloud removed",
 * where counting after would always be zero.
 */
export const DISSOLVE: CardDef = {
  id: cardId('cloud-dissolve'),
  name: 'Dissolve',
  cost: 1,
  text: 'Deal 2 damage for each cloud. Remove all clouds.',
};

export const RISE_AND_SHINE: CardDef = {
  id: cardId('cloud-rise-and-shine'),
  name: 'Rise and Shine',
  cost: 1,
  text: 'Fill all empty cloud slots with random clouds.',
};

export const LUNAR_WEATHER: CardDef = {
  id: cardId('cloud-lunar-weather'),
  name: 'Lunar Weather',
  cost: 1,
  text: 'Remove 1 cloud. Create 1 random cloud.',
};

/**
 * Designed as "deal 4 damage, trigger all Storm Clouds". A Storm Cloud's trigger
 * is 1 damage, so triggering N of them is N damage — expressed here as a scaled
 * deal rather than by re-firing the clouds themselves. One nuance: a real Storm
 * Cloud hits a *random* opponent while this hits your chosen target. Identical
 * while a battle has a single opponent, which is all the design has today.
 */
export const WHIRLWIND: CardDef = {
  id: cardId('cloud-whirlwind'),
  name: 'Whirlwind',
  cost: 1,
  text: 'Deal 4 damage. Deal 1 damage for each storm cloud.',
};

/** Designed as "next turn, your clouds play twice" — verb-first so it parses. */
export const SOLAR_POWER: CardDef = {
  id: cardId('cloud-solar-power'),
  name: 'Solar Power',
  cost: 1,
  text: 'Double your clouds next turn.',
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
  DRAW_LATER,
  DRAW_NOW,
  EMPTY_OUT,
  SPARK,
  CLEAR,
  FINAL_SHOCK,
  OUTBURST,
  SPATIAL_REASONING,
  DISSOLVE,
  RISE_AND_SHINE,
  LUNAR_WEATHER,
  WHIRLWIND,
  SOLAR_POWER,
];
