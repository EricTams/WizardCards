/**
 * Markings — the Knight's keyword: "Marked cards activate their Marked Effect
 * when played, and then lose the special effect. Cards can have multiple
 * Markings."
 *
 * A Marking is per-*copy* state with a value, living on `CardInstance.marks`.
 * It isn't authored in a card's own text — it is put there by another card
 * ("Mark two Cards in your hand with Sharp 2") — so unlike Molt there is nothing
 * to compile: each kind maps to one fixed effect, scaled by its value.
 *
 *   Sharp N    → deal N damage to a random enemy
 *   Sturdy N   → draw N cards
 *   Flaming N  → gain N energy
 *   Safe N     → heal N
 *
 * The effects resolve as the card is played, *before* the card's own text, and
 * the marks are then gone with the copy (it has left the hand for the discard
 * pile — nothing needs to erase them).
 */
import type { Action, CardInstance } from '@engine/index';
import { MARK_KINDS, type EntityId, type MarkKind } from '@shared/index';

/** The atomic actions one marked copy owes when it is played. */
export function markEffects(instance: CardInstance | undefined, self: EntityId): Action[] {
  const marks = instance?.marks;
  if (!marks) return [];
  const actions: Action[] = [];
  // Iterate MARK_KINDS rather than the object's own keys: the order a card was
  // marked in must not change what a replay produces.
  for (const kind of MARK_KINDS) {
    const value = marks[kind] ?? 0;
    if (value === 0) continue;
    // Announce first, so "when you play a card Marked with Sharp" (Engrave)
    // fires alongside the Marking rather than after its consequences.
    actions.push({ type: 'NoteMarkedCardPlayed', owner: self, mark: kind });
    actions.push(effectFor(kind, value, self));
  }
  return actions;
}

/** How many distinct Markings a copy carries (Invade scales off this). */
export function uniqueMarkings(instance: CardInstance | undefined): number {
  const marks = instance?.marks;
  if (!marks) return 0;
  return MARK_KINDS.filter((kind) => (marks[kind] ?? 0) > 0).length;
}

function effectFor(kind: MarkKind, value: number, self: EntityId): Action {
  switch (kind) {
    case 'sharp':
      return { type: 'DealDamageToRandomEnemy', self, amount: value };
    case 'sturdy':
      return { type: 'DrawCards', owner: self, count: value };
    case 'flaming':
      return { type: 'GainEnergy', target: self, amount: value };
    case 'safe':
      return { type: 'Heal', target: self, amount: value };
  }
}
