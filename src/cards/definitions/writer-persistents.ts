/**
 * The Writer's Persistent (ongoing) cards — the authored subset.
 *
 * Ink and Wordsmith both pay out on Burn, which is now Craft leaving the bank;
 * Whiteboard tops it back up each turn.
 *
 * Still to come, needing machinery the trigger grammar doesn't have yet:
 * Shake Spear and Direct ("when you play a Fading card"), Paper Trail ("when
 * you draw a Burn card"), Ask AI, Editor, and Scribe ("additional" draws as a
 * distinct event, and Bravery that resets at end of turn).
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const INK: CardDef = {
  id: cardId('writer-ink'),
  name: 'Ink',
  cost: 1,
  text: 'When you burn, deal 1 damage to all opponents.',
};

export const WORDSMITH: CardDef = {
  id: cardId('writer-wordsmith'),
  name: 'Wordsmith',
  cost: 1,
  text: 'When you burn, gain 1 shield.',
};

export const WHITEBOARD: CardDef = {
  id: cardId('writer-whiteboard'),
  name: 'Whiteboard',
  cost: 1,
  text: 'At the end of your turn, craft 1.',
};

export const WRITER_PERSISTENTS: readonly CardDef[] = [INK, WORDSMITH, WHITEBOARD];
