import { pileOf } from '@cards/index';
import { describe, it, expect } from 'vitest';
import { initialState, apply, makeCombatant, type GameState } from '@engine/index';
import { entityId, cardId, type CardId } from '@shared/index';

const ENEMY = entityId('enemy');

function withEnemy(state: GameState): GameState {
  return {
    ...state,
    enemies: [makeCombatant({ id: ENEMY, name: 'Dummy', hp: 20, maxHp: 20 })],
  };
}

describe('reducer: apply', () => {
  it('deals damage, absorbing block first', () => {
    let state = withEnemy(initialState({ seed: 's', deck: [] }));
    state = apply(state, { type: 'GainBlock', target: ENEMY, amount: 5 }).state;
    const result = apply(state, { type: 'DealDamage', target: ENEMY, amount: 8 });
    const enemy = result.state.enemies[0]!;
    expect(enemy.block).toBe(0); // 5 block absorbed
    expect(enemy.hp).toBe(17); // 3 damage through
    expect(result.events).toContainEqual({ type: 'DamageDealt', target: ENEMY, amount: 8, unblocked: 3 });
  });

  it('never lets hp go below zero', () => {
    let state = withEnemy(initialState({ seed: 's', deck: [] }));
    state = apply(state, { type: 'DealDamage', target: ENEMY, amount: 999 }).state;
    expect(state.enemies[0]!.hp).toBe(0);
  });

  it('draws cards from the draw pile into hand', () => {
    const deck: CardId[] = [cardId('a'), cardId('b'), cardId('c')];
    const state = initialState({ seed: 's', deck });
    const result = apply(state, { type: 'DrawCards', count: 2 });
    expect(result.state.player.hand).toHaveLength(2);
    expect(result.state.player.drawPile).toHaveLength(1);
  });

  it('reshuffles the discard pile when the draw pile is empty', () => {
    const base = initialState({ seed: 's', deck: [] });
    const state: GameState = {
      ...base,
      player: { ...base.player, drawPile: [], discardPile: pileOf(cardId('x'), cardId('y')) },
    };
    const result = apply(state, { type: 'DrawCards', count: 1 });
    expect(result.state.player.hand).toHaveLength(1);
    expect(result.events.map((e) => e.type)).toContain('DeckReshuffled');
  });

  it('does not mutate the input state', () => {
    const state = withEnemy(initialState({ seed: 's', deck: [] }));
    const snapshot = structuredClone(state);
    apply(state, { type: 'DealDamage', target: ENEMY, amount: 5 });
    expect(state).toEqual(snapshot);
  });
});
