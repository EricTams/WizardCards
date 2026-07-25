/**
 * The Wizard — persistent (ongoing) cards, authored in English.
 *
 * Trigger→effect persistents whose behavior is parsed from `text` by the trigger
 * grammar (`docs/triggers.md`). Rot Away reacts to unblocked damage; Consuming
 * reacts to a minion being discarded.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const ROT_AWAY: CardDef = {
  id: cardId('wizard-rot-away'),
  name: 'Rot Away',
  cost: 1,
  text: 'Whenever you deal unblocked damage, poison 1.',
};

export const CONSUMING: CardDef = {
  id: cardId('wizard-consuming'),
  name: 'Consuming',
  cost: 1,
  text: 'When a minion is discarded, heal 1.',
};

export const PROTECT_THE_DRINKS: CardDef = {
  id: cardId('wizard-protect-the-drinks'),
  name: 'Protect the Drinks',
  cost: 1,
  text: 'Minions are replayed 1 additional time.',
};

export const JUGGLE: CardDef = {
  id: cardId('wizard-juggle'),
  name: 'Juggle',
  cost: 1,
  text: 'When a minion is replayed, gain 1 block.',
};

export const WIZARD_PERSISTENTS: readonly CardDef[] = [ROT_AWAY, CONSUMING, PROTECT_THE_DRINKS, JUGGLE];
