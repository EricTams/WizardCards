import { describe, it, expect } from 'vitest';
import { buildTestState, playCard, startTurn, endTurn, TEST_SELF, TEST_TARGET } from '@cards/index';
import { SPRING, WINTER, STATIC, SUMMER, FALL } from '@cards/definitions/cloud-persistents';
import { ROT_AWAY, CONSUMING } from '@cards/definitions/wizard-persistents';
import { THUNDER, SHINE } from '@cards/definitions/cloud';
import { STUN, THROW, ALCHEMY } from '@cards/definitions/wizard';
import { entityId, type CardId } from '@shared/index';
import type { CardDef } from '@cards/index';
import type { MinionState } from '@engine/index';

const dummyMinion = (id: CardId): MinionState => ({ id: entityId('minion-seed'), cardId: id });
const ctxFor = (card: CardDef) => ({ self: TEST_SELF, target: TEST_TARGET, sourceCard: card.id });

describe('cloud start-of-turn triggers', () => {
  it('fires one effect per cloud and clears temporary block', () => {
    const state = buildTestState({
      player: { hp: 20, maxHp: 30, energy: 0, block: 5, clouds: ['lightning', 'snow', 'storm', 'fog'] },
      target: { hp: 30, maxHp: 30 },
      drawPile: ['a', 'b', 'c'] as CardId[],
    });
    const { state: after } = startTurn(state, { draw: 0 });

    expect(after.player.energy).toBe(1); // Lightning
    expect(after.player.hp).toBe(21); // Snow heals 1
    expect(after.player.block).toBe(0); // block cleared
    expect(after.enemies[0]!.hp).toBe(29); // Storm deals 1
    expect(after.player.hand).toHaveLength(1); // Fog draws 1
    expect(after.player.drawPile).toHaveLength(2);
  });

  it('Winter makes Snow clouds heal 2', () => {
    const state = buildTestState({ player: { hp: 20, maxHp: 30, clouds: ['snow'], persistents: [WINTER.id] } });
    const { state: after } = startTurn(state, { draw: 0 });
    expect(after.player.hp).toBe(22);
  });

  it('replays a minion (minus re-summoning itself)', () => {
    const state = buildTestState({ player: { poison: 0, minions: [dummyMinion(ALCHEMY.id)] } });
    const { state: after } = startTurn(state, { draw: 0 });
    expect(after.player.poison).toBe(1); // Alchemy: "Minion. Poison 1." replays the Poison 1
    expect(after.player.minions).toHaveLength(1); // did not summon a second minion
  });
});

describe('reactive persistents', () => {
  it('Spring: creating a cloud deals to all opponents', () => {
    const state = buildTestState({ player: { persistents: [SPRING.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = playCard(state, THUNDER, ctxFor(THUNDER));
    expect(after.player.clouds).toHaveLength(1); // Thunder created a Lightning cloud
    expect(after.enemies[0]!.hp).toBe(29); // Spring dealt 1
  });

  it('Static: removing a Lightning cloud deals 2 to all opponents', () => {
    const state = buildTestState({ player: { clouds: ['lightning'], persistents: [STATIC.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = playCard(state, SHINE, ctxFor(SHINE)); // Deal 6, Remove 3 clouds
    expect(after.player.clouds).toHaveLength(0);
    expect(after.enemies[0]!.hp).toBe(22); // 6 (Shine) + 2 (Static)
  });

  it('Rot Away: dealing unblocked damage adds poison', () => {
    const state = buildTestState({ player: { poison: 0, persistents: [ROT_AWAY.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = playCard(state, STUN, ctxFor(STUN)); // Deal 3
    expect(after.enemies[0]!.hp).toBe(27);
    expect(after.player.poison).toBe(1);
  });

  it('Consuming: discarding a minion heals', () => {
    const state = buildTestState({
      player: { hp: 20, maxHp: 30, persistents: [CONSUMING.id], minions: [dummyMinion(THROW.id)] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playCard(state, THROW, ctxFor(THROW)); // Deal 8, Discard 1 minion
    expect(after.enemies[0]!.hp).toBe(22);
    expect(after.player.minions).toHaveLength(0);
    expect(after.player.hp).toBe(21); // Consuming healed 1
  });

  it('Summer: starting a turn with over 3 energy deals 4 to all opponents', () => {
    const state = buildTestState({ player: { energy: 4, persistents: [SUMMER.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = startTurn(state, { draw: 0 });
    expect(after.enemies[0]!.hp).toBe(26);
  });
});

describe('end of turn', () => {
  it('Fog clouds force a discard', () => {
    const state = buildTestState({ player: { clouds: ['fog'] }, hand: ['a', 'b'] as CardId[] });
    const { state: after } = endTurn(state);
    expect(after.player.hand).toHaveLength(1);
    expect(after.player.discardPile).toHaveLength(1);
    expect(after.phase).toBe('enemyTurn');
  });

  it('Fall suppresses the Fog discard', () => {
    const state = buildTestState({ player: { clouds: ['fog'], persistents: [FALL.id] }, hand: ['a', 'b'] as CardId[] });
    const { state: after } = endTurn(state);
    expect(after.player.hand).toHaveLength(2);
    expect(after.player.discardPile).toHaveLength(0);
  });
});

describe('determinism through the orchestrator', () => {
  it('same setup + same play => identical state', () => {
    const setup = { player: { clouds: ['storm', 'storm'] as const }, target: { hp: 30, maxHp: 30 } };
    const a = startTurn(buildTestState(setup), { draw: 0 }).state;
    const b = startTurn(buildTestState(setup), { draw: 0 }).state;
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});
