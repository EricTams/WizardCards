/**
 * The Crab — persistent (ongoing) cards, authored in English.
 *
 * Only Crab Trap is expressible with today's trigger grammar. The Crab's other
 * six designed persistents all key off things the engine can't yet observe —
 * how much of your hand you discarded, whether a discarded card had Claw, a
 * deck shuffle — see `docs/roadmap.md`.
 */
import { cardId } from '@shared/index';
import type { CardDef } from '@cards/registry';

export const CRAB_TRAP: CardDef = {
  id: cardId('crab-crab-trap'),
  name: 'Crab Trap',
  cost: 1,
  text: 'At the start of your turn, draw 1 additional card.',
};

export const CRAB_PERSISTENTS: readonly CardDef[] = [CRAB_TRAP];
