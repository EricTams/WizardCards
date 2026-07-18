/**
 * The persistents currently in play, as runtime behavior.
 *
 * A persistent in `player.persistents` is a CardId. Its behavior is compiled from
 * the registered card's English text (`compilePersistent`) — the same trigger
 * grammar authors use. Compilation is memoized by id since card text is static.
 */
import type { CardId } from '@shared/index';
import type { GameState } from '@engine/index';
import { getCard } from '@cards/registry';
import { compilePersistent, type PersistentBehavior } from '@cards/match/compile-persistent';

const CACHE = new Map<string, PersistentBehavior>();

/** Behavior for one persistent card id (empty if unknown / doesn't compile). */
export function persistentBehavior(id: CardId): PersistentBehavior {
  const key = id as string;
  let behavior = CACHE.get(key);
  if (!behavior) {
    const card = getCard(id);
    behavior = card ? compilePersistent(card.text) : {};
    CACHE.set(key, behavior);
  }
  return behavior;
}

/** The behaviors of every persistent the player has in play. */
export function activePersistents(state: GameState): PersistentBehavior[] {
  return state.player.persistents.map(persistentBehavior);
}

export type { PersistentBehavior } from '@cards/match/compile-persistent';
