/**
 * The Cloud — persistent (ongoing) cards, authored in English.
 *
 * These used to be code-defined; now their behavior is parsed from their `text`
 * by the trigger grammar (`docs/triggers.md`, `docs/card-dsl.md`). Winter and
 * Autumn are *modifier* persistents (they change how a rule behaves rather than
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

export const AUTUMN: CardDef = {
  id: cardId('cloud-autumn'),
  name: 'Autumn',
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

export const CLOUD_PERSISTENTS: readonly CardDef[] = [WINTER, AUTUMN, SPRING, SUMMER, STATIC];
