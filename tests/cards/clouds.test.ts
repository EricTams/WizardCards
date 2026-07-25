import { describe, it, expect } from 'vitest';
import { buildTestState, playFromHand, capClouds, cloudCapFor, CLOUD_CAP, TEST_SELF } from '@cards/index';
import { OUTBURST, SPATIAL_REASONING, DISSOLVE } from '@cards/definitions/cloud';

describe('remove all clouds (Dissolve)', () => {
  it('deals 2 per cloud held, then wipes them', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [DISSOLVE.id], clouds: ['storm', 'fog', 'snow'] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.enemies[0]!.hp).toBe(24); // 2 x 3 clouds
    expect(after.player.clouds).toHaveLength(0);
  });

  it('is harmless with no clouds — 0 damage, not a crash', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [DISSOLVE.id], clouds: [] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.enemies[0]!.hp).toBe(30);
    expect(after.player.clouds).toHaveLength(0);
  });
});

describe('increase max clouds', () => {
  it('Outburst widens the cap and makes a cloud', () => {
    const state = buildTestState({ player: { energy: 5, hand: [OUTBURST.id] }, target: { hp: 30, maxHp: 30 } });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.clouds).toEqual(['storm']);
    expect(cloudCapFor(after.player)).toBe(CLOUD_CAP + 1);
  });

  it('stacks across plays', () => {
    let s = buildTestState({
      player: { energy: 5, hand: [OUTBURST.id, SPATIAL_REASONING.id] },
      target: { hp: 30, maxHp: 30 },
    });
    s = playFromHand(s, TEST_SELF, 0).state;
    s = playFromHand(s, TEST_SELF, 0).state;
    expect(cloudCapFor(s.player)).toBe(CLOUD_CAP + 2);
  });

  it('the widened cap is what actually gets enforced', () => {
    // capClouds trims to the cap; with a bonus slot it must keep one more. This
    // is the check that matters — a bonus nothing enforces is a no-op.
    const base = buildTestState({ player: { clouds: ['storm', 'fog', 'snow', 'lightning'] } });
    expect(capClouds(base, TEST_SELF).state.player.clouds).toHaveLength(CLOUD_CAP);

    const widened = {
      ...base,
      player: { ...base.player, bonusMaxClouds: 1, clouds: ['storm', 'fog', 'snow', 'lightning'] as const },
    };
    expect(capClouds(widened, TEST_SELF).state.player.clouds).toHaveLength(CLOUD_CAP + 1);
  });
});
