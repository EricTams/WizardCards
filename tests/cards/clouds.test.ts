import { describe, it, expect } from 'vitest';
import { buildTestState, playFromHand, endTurn, startTurn, capClouds, cloudCapFor, CLOUD_CAP, TEST_SELF } from '@cards/index';
import { OUTBURST, SPATIAL_REASONING, DISSOLVE, RISE_AND_SHINE, LUNAR_WEATHER, WHIRLWIND, SOLAR_POWER } from '@cards/definitions/cloud';
import { WILD_WIND, WINDMILL } from '@cards/definitions/cloud-persistents';

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

describe('random cloud generation', () => {
  it('Lunar Weather swaps one cloud for a random one', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [LUNAR_WEATHER.id], clouds: ['storm', 'fog'] },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.clouds).toHaveLength(2); // removed 1, created 1
  });

  it('Rise and Shine fills empty slots up to the cap, and no further', () => {
    const state = buildTestState({ player: { energy: 5, hand: [RISE_AND_SHINE.id], clouds: ['storm'] } });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.clouds).toHaveLength(CLOUD_CAP);
    expect(after.player.clouds[0]).toBe('storm'); // the one you had is untouched
  });

  it('Rise and Shine respects a widened cap', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [RISE_AND_SHINE.id], clouds: [], bonusMaxClouds: 2 },
    });
    expect(playFromHand(state, TEST_SELF, 0).state.player.clouds).toHaveLength(CLOUD_CAP + 2);
  });

  it('Rise and Shine does nothing when already full', () => {
    const full = ['storm', 'fog', 'snow'] as const;
    const state = buildTestState({ player: { energy: 5, hand: [RISE_AND_SHINE.id], clouds: full } });
    expect(playFromHand(state, TEST_SELF, 0).state.player.clouds).toEqual([...full]);
  });

  it('Windmill refills at end of turn', () => {
    const state = buildTestState({ player: { persistents: [WINDMILL.id], clouds: ['snow'] } });
    expect(endTurn(state).state.player.clouds.length).toBeGreaterThanOrEqual(CLOUD_CAP);
  });

  it('Wild Wind keeps the cloud count steady while churning it', () => {
    const state = buildTestState({ player: { persistents: [WILD_WIND.id], clouds: ['snow', 'fog'] } });
    expect(endTurn(state).state.player.clouds).toHaveLength(2);
  });

  it('stays deterministic: same seed, same weather — and advances the RNG', () => {
    const make = () =>
      buildTestState({ seed: 'weather', player: { energy: 5, hand: [RISE_AND_SHINE.id], clouds: [] } });
    const a = playFromHand(make(), TEST_SELF, 0).state;
    const b = playFromHand(make(), TEST_SELF, 0).state;
    expect(a.player.clouds).toEqual(b.player.clouds);
    expect(a.rng).not.toBe(make().rng); // the draws actually consumed randomness
    expect(JSON.parse(JSON.stringify(a))).toEqual(a); // still plain data
  });

  it('does not always roll the same cloud type', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = buildTestState({ seed: `w${i}`, player: { energy: 5, hand: [RISE_AND_SHINE.id], clouds: [] } });
      playFromHand(s, TEST_SELF, 0).state.player.clouds.forEach((c) => kinds.add(c));
    }
    expect(kinds.size).toBeGreaterThan(1);
  });
});

describe('Whirlwind — scaling off one cloud type', () => {
  it('adds 1 damage per storm cloud, ignoring other kinds', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [WHIRLWIND.id], clouds: ['storm', 'fog', 'storm', 'snow'] },
      target: { hp: 30, maxHp: 30 },
    });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.enemies[0]!.hp).toBe(24); // 4 base + 1 per storm x2
  });

  it('is just its base damage with no storms', () => {
    const state = buildTestState({
      player: { energy: 5, hand: [WHIRLWIND.id], clouds: ['fog', 'snow'] },
      target: { hp: 30, maxHp: 30 },
    });
    expect(playFromHand(state, TEST_SELF, 0).state.enemies[0]!.hp).toBe(26);
  });
});

describe('Solar Power — clouds play twice next turn', () => {
  it('arms the flag rather than firing anything now', () => {
    const state = buildTestState({ player: { energy: 5, hand: [SOLAR_POWER.id], clouds: ['lightning'] } });
    const { state: after } = playFromHand(state, TEST_SELF, 0);
    expect(after.player.cloudsPlayTwice).toBe(true);
    expect(after.player.energy).toBe(4); // spent on the card; no cloud fired yet
  });

  it('doubles the next turn\'s cloud effects, then spends itself', () => {
    const armed = buildTestState({ player: { clouds: ['lightning'], cloudsPlayTwice: true } });
    const next = startTurn(armed, { draw: 0, resetEnergyTo: 0 }).state;
    expect(next.player.energy).toBe(2); // 1 lightning fired twice
    expect(next.player.cloudsPlayTwice).toBe(false); // consumed

    // …and the turn after is back to normal.
    const after = startTurn(next, { draw: 0, resetEnergyTo: 0 }).state;
    expect(after.player.energy).toBe(1);
  });

  it('is a no-op when unarmed', () => {
    const plain = buildTestState({ player: { clouds: ['lightning'] } });
    expect(startTurn(plain, { draw: 0, resetEnergyTo: 0 }).state.player.energy).toBe(1);
  });
});
