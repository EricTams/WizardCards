import { describe, it, expect } from 'vitest';
import { makeArena, addTarget, removeTarget } from '@ui/cardlab/arena';
import { applyAll } from '@engine/index';
import { compile } from '@cards/index';
import { entityId, cardId } from '@shared/index';

describe('card lab arena', () => {
  it('starts with a player and one target on the player turn', () => {
    const arena = makeArena();
    expect(arena.phase).toBe('playerTurn');
    expect(arena.enemies).toHaveLength(1);
    expect(arena.enemies[0]!.hp).toBe(30);
  });

  it('adds targets with stable, unique ids', () => {
    let arena = makeArena();
    arena = addTarget(arena);
    arena = addTarget(arena);
    const ids = arena.enemies.map((e) => e.id);
    expect(ids).toEqual(['target-0', 'target-1', 'target-2']);
    expect(new Set(ids).size).toBe(3);
  });

  it('reuses the lowest free id after a removal', () => {
    let arena = addTarget(makeArena()); // target-0, target-1
    arena = removeTarget(arena, entityId('target-0'));
    arena = addTarget(arena);
    expect(arena.enemies.map((e) => e.id)).toEqual(['target-1', 'target-0']);
  });

  it('playing a compiled card against a target reduces its hp through the engine', () => {
    const arena = makeArena();
    const target = arena.enemies[0]!;
    const compiled = compile('Deal 6 damage.');
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const actions = compiled.value.map((p) =>
      p({ self: arena.player.id, target: target.id, sourceCard: cardId('strike') }),
    );
    const after = applyAll(arena, actions).state;
    expect(after.enemies[0]!.hp).toBe(24);
  });
});
