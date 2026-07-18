import { describe, it, expect } from 'vitest';
import { parse } from '@cards/index';
import type { EffectNode } from '@cards/index';

/** Parse and assert success, returning the effect nodes. */
function effects(text: string): readonly EffectNode[] {
  const result = parse(text);
  expect(result.ok, `"${text}" failed to parse`).toBe(true);
  return result.ok ? result.value.effects : [];
}

describe('parser grammar', () => {
  it('parses a single deal statement', () => {
    expect(effects('Deal 6 damage.')).toEqual([
      { kind: 'Effect', verb: 'deal', amount: 6, noun: 'damage', start: 0, end: 13 },
    ]);
  });

  it('splits statements on commas as well as periods', () => {
    const parsed = effects('Deal 3 damage, Remove 1 cloud.');
    expect(parsed.map((e) => e.verb)).toEqual(['deal', 'remove']);
    expect(parsed[1]).toMatchObject({ verb: 'remove', amount: 1, noun: 'cloud' });
  });

  it('routes gain to the named resource, plural-insensitively', () => {
    expect(effects('Gain 4 shields.')[0]).toMatchObject({ verb: 'gain', amount: 4, noun: 'shield' });
    expect(effects('Gain 1 energy.')[0]).toMatchObject({ verb: 'gain', amount: 1, noun: 'energy' });
  });

  it('parses create with a cloud type', () => {
    expect(effects('Create 2 storm clouds.')[0]).toMatchObject({
      verb: 'create',
      amount: 2,
      cloudType: 'storm',
    });
  });

  it('parses heal and poison without a noun', () => {
    expect(effects('Heal 3.')[0]).toMatchObject({ verb: 'heal', amount: 3 });
    expect(effects('Poison 5.')[0]).toMatchObject({ verb: 'poison', amount: 5 });
  });

  it('parses bare keyword effects', () => {
    expect(effects('Venom. Drink.').map((e) => e.verb)).toEqual(['venom', 'drink']);
    expect(effects('Minion. Poison 1.').map((e) => e.verb)).toEqual(['minion', 'poison']);
  });

  it('reports an unknown verb with a source span, not a throw', () => {
    const result = parse('Frobnicate 2 widgets.');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ severity: 'error', start: 0, end: 10 });
  });

  it('rejects an unknown cloud type', () => {
    const result = parse('Create 1 rain cloud.');
    expect(result.ok).toBe(false);
  });

  it('rejects a gain of an unknown resource', () => {
    const result = parse('Gain 2 courage.');
    expect(result.ok).toBe(false);
  });
});

describe('scaling grammar', () => {
  it('parses "deal damage equal to your <resource>"', () => {
    expect(effects('Deal damage equal to your energy.')[0]).toMatchObject({
      verb: 'deal',
      scale: { per: 'energy' },
    });
    // no literal amount — it defaults to ×1
    expect(effects('Deal damage equal to your energy.')[0]!.amount).toBeUndefined();
  });

  it('parses "deal N damage for each [unique] <countable>"', () => {
    expect(effects('Deal 3 damage for each unique cloud.')[0]).toMatchObject({
      verb: 'deal',
      amount: 3,
      scale: { per: 'uniqueClouds' },
    });
    expect(effects('Deal 2 damage for each cloud.')[0]).toMatchObject({ scale: { per: 'clouds' } });
    expect(effects('Deal 1 damage for each minion.')[0]).toMatchObject({ scale: { per: 'minions' } });
  });

  it('rejects scaling on a non-deal verb', () => {
    expect(parse('Gain 1 shield for each minion.').ok).toBe(false);
  });

  it('rejects "equal to your <unknown>"', () => {
    expect(parse('Deal damage equal to your courage.').ok).toBe(false);
  });
});
