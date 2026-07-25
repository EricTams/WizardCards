import { describe, it, expect } from 'vitest';
import { describeEvent, describeEvents, nameMap } from '@ui/game/combatLog';
import { initialState, makeCombatant, type GameEvent } from '@engine/index';
import { entityId, cardId } from '@shared/index';

const P = entityId('player');
const E = entityId('enemy');
const names = { player: 'The Wizard', enemy: 'The Cloud' };

describe('combat log formatting', () => {
  it('formats damage, showing what was blocked', () => {
    expect(describeEvent({ type: 'DamageDealt', target: E, amount: 6, unblocked: 4 }, names)).toBe(
      '4 damage → The Cloud (2 blocked)',
    );
    expect(describeEvent({ type: 'DamageDealt', target: E, amount: 3, unblocked: 3 }, names)).toBe('3 damage → The Cloud');
  });

  it('formats resources, clouds, and poison spending', () => {
    expect(describeEvent({ type: 'ShieldGained', target: P, amount: 5 }, names)).toBe('+5 shield → The Wizard');
    expect(describeEvent({ type: 'CloudsCreated', target: E, cloudType: 'storm', count: 2 }, names)).toBe(
      '+2 Storm clouds → The Cloud',
    );
    expect(describeEvent({ type: 'PoisonChanged', target: P, amount: 3 }, names)).toBe('+3 poison → The Wizard');
    expect(describeEvent({ type: 'PoisonChanged', target: P, amount: -7 }, names)).toBe('poison spent (7)');
  });

  it('skips structural / bookkeeping events', () => {
    expect(describeEvent({ type: 'EnergySet', target: P, amount: 1 }, names)).toBeNull();
    expect(describeEvent({ type: 'BlockCleared', target: P }, names)).toBeNull();
    expect(describeEvent({ type: 'PhaseChanged', phase: 'enemyTurn' }, names)).toBeNull();
  });

  it("drops the played card's own discard so a play reads as just its effects", () => {
    const zap = cardId('cloud-zap');
    const events: GameEvent[] = [
      { type: 'CardsDiscarded', owner: P, cards: [zap], instances: [], reason: 'play' }, // the card leaving hand
      { type: 'DamageDealt', target: E, amount: 2, unblocked: 2 },
      { type: 'EnergyGained', target: P, amount: 1 },
    ];
    expect(describeEvents(events, names, { skipCardId: zap })).toEqual(['2 damage → The Cloud', '+1 energy → The Wizard']);
  });

  it('nameMap maps the player and every enemy', () => {
    const s = {
      ...initialState({ seed: 'x', deck: [] }),
      player: makeCombatant({ id: P, name: 'P', hp: 1, maxHp: 1 }),
      enemies: [makeCombatant({ id: E, name: 'E', hp: 1, maxHp: 1 })],
    };
    expect(nameMap(s)).toEqual({ player: 'P', enemy: 'E' });
  });
});
