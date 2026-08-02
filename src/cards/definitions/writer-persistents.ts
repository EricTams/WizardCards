/**
 * The Writer's Persistent (ongoing) cards — the authored subset.
 *
 * Still to come, needing machinery the trigger grammar doesn't have yet:
 * Shake-Spear and Scribe ("additional" draws as a distinct event), Direct (Burn
 * cost discount), Whiteboard (end-of-turn hand census), Ask AI (Find replays per
 * Unplayable found), Editor (Find draw bonus), and Wordsmith (an untriggered
 * ongoing burn).
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const INK: CardDef = {
  id: cardId('writer-ink'),
  name: 'Ink',
  cost: 1,
  text: 'When you burn an unplayable card, deal 2 damage to all opponents.',
};

export const PAPER_TRAIL: CardDef = {
  id: cardId('writer-paper-trail'),
  name: 'Paper Trail',
  cost: 1,
  text: 'When you draw an unplayable card, draw 1 additional card.',
};

export const WRITER_PERSISTENTS: readonly CardDef[] = [INK, PAPER_TRAIL];
