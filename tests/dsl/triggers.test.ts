import { describe, it, expect } from 'vitest';
import { parse, compile } from '@cards/index';
import type { CardScript } from '@cards/index';
import { SPRING, SUMMER, STATIC, WINTER, FALL } from '@cards/definitions/cloud-persistents';
import { ROT_AWAY, CONSUMING } from '@cards/definitions/wizard-persistents';

function script(text: string): CardScript {
  const result = parse(text);
  expect(result.ok, `"${text}" failed to parse`).toBe(true);
  return result.ok ? result.value : { kind: 'CardScript', effects: [], triggers: [], modifiers: [] };
}

describe('trigger grammar', () => {
  it('parses "whenever you create a cloud, …" with a targeted effect', () => {
    const s = script('Whenever you create a cloud, deal 1 damage to all opponents.');
    expect(s.effects).toEqual([]);
    expect(s.triggers).toHaveLength(1);
    expect(s.triggers[0]).toMatchObject({ event: 'createCloud' });
    expect(s.triggers[0]!.effects[0]).toMatchObject({ verb: 'deal', amount: 1, target: 'allEnemies' });
  });

  it('captures the cloud type on a removal trigger', () => {
    const s = script('Whenever a lightning cloud is removed, deal 2 damage to all opponents.');
    expect(s.triggers[0]).toMatchObject({ event: 'removeCloud', cloudType: 'lightning' });
  });

  it('parses minion-discard and unblocked-damage triggers', () => {
    expect(script('When a minion is discarded, heal 1.').triggers[0]).toMatchObject({ event: 'discardMinion' });
    expect(script('Whenever you deal unblocked damage, poison 1.').triggers[0]).toMatchObject({
      event: 'dealUnblockedDamage',
    });
  });

  it('parses a start-of-turn trigger with a condition', () => {
    const s = script('At the start of your turn, if you have over 3 energy, deal 4 damage to all opponents.');
    expect(s.triggers[0]).toMatchObject({
      event: 'startTurn',
      condition: { resource: 'energy', op: 'gt', amount: 3 },
    });
    expect(s.triggers[0]!.effects[0]).toMatchObject({ verb: 'deal', amount: 4, target: 'allEnemies' });
  });

  it('parses "to a random opponent" targeting', () => {
    const s = script('Whenever you create a cloud, deal 1 damage to a random opponent.');
    expect(s.triggers[0]!.effects[0]).toMatchObject({ target: 'randomEnemy' });
  });

  it('parses cloud modifiers (Winter, Fall)', () => {
    expect(script('Snow clouds heal 2 instead of 1.').modifiers[0]).toMatchObject({
      modifier: 'snowHealBonus',
      amount: 1,
    });
    expect(script('Fog clouds no longer force a discard.').modifiers[0]).toMatchObject({
      modifier: 'suppressFogDiscard',
    });
  });

  it('still parses plain on-play effects alongside the new grammar', () => {
    const s = script('Deal 6 damage.');
    expect(s.effects).toHaveLength(1);
    expect(s.triggers).toEqual([]);
    expect(s.modifiers).toEqual([]);
  });

  it('a card can mix an immediate effect and a trigger', () => {
    const s = script('Deal 3 damage. Whenever you create a cloud, deal 1 damage to all opponents.');
    expect(s.effects[0]).toMatchObject({ verb: 'deal', amount: 3 });
    expect(s.triggers).toHaveLength(1);
  });

  it('reports an unrecognized trigger with a source span', () => {
    const result = parse('Whenever the moon is full, deal 1 damage.');
    expect(result.ok).toBe(false);
  });

  it('every persistent card compiles to zero on-play actions', () => {
    for (const card of [SPRING, SUMMER, STATIC, WINTER, FALL, ROT_AWAY, CONSUMING]) {
      const compiled = compile(card.text);
      expect(compiled.ok, `"${card.text}" failed to compile`).toBe(true);
      if (compiled.ok) expect(compiled.value).toEqual([]);
    }
  });
});
