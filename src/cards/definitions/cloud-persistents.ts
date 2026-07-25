/**
 * The Cloud — persistent (ongoing) cards, authored in English.
 *
 * These used to be code-defined; now their behavior is parsed from their `text`
 * by the trigger grammar (`docs/triggers.md`, `docs/card-dsl.md`). Winter and
 * Fall are *modifier* persistents (they change how a rule behaves rather than
 * firing an effect); Spring/Summer/Static are trigger→effect persistents.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const WINTER: CardDef = {
  id: cardId('cloud-winter'),
  name: 'Winter',
  cost: 1,
  text: 'Snow clouds heal 2 instead of 1.',
};

/**
 * Named "Fall" to match its art (`Cloud Cards-Fall.png`) — cardArtUrl() builds
 * the file name from `name`, so the two must agree. The id keeps the older
 * `cloud-autumn` slug: ids key Card Lab overrides in localStorage, and renaming
 * one silently orphans a player's saved edits.
 */
export const FALL: CardDef = {
  id: cardId('cloud-autumn'),
  name: 'Fall',
  cost: 1,
  text: 'Fog clouds no longer force a discard.',
};

export const SPRING: CardDef = {
  id: cardId('cloud-spring'),
  name: 'Spring',
  cost: 1,
  text: 'Whenever you create a cloud, deal 1 damage to all opponents.',
};

export const SUMMER: CardDef = {
  id: cardId('cloud-summer'),
  name: 'Summer',
  cost: 1,
  text: 'At the start of your turn, if you have over 3 energy, deal 4 damage to all opponents.',
};

export const STATIC: CardDef = {
  id: cardId('cloud-static'),
  name: 'Static',
  cost: 1,
  text: 'Whenever a lightning cloud is removed, deal 2 damage to all opponents.',
};

/** Churn the sky: swap one cloud for a fresh random one each turn. */
export const WILD_WIND: CardDef = {
  id: cardId('cloud-wild-wind'),
  name: 'Wild Wind',
  cost: 1,
  text: 'At the end of your turn, remove 1 random cloud, create 1 random cloud.',
};

export const WINDMILL: CardDef = {
  id: cardId('cloud-windmill'),
  name: 'Windmill',
  cost: 1,
  text: 'At the end of your turn, fill all empty cloud slots with random clouds.',
};

export const CLOUD_PERSISTENTS: readonly CardDef[] = [WINTER, FALL, SPRING, SUMMER, STATIC, WILD_WIND, WINDMILL];
