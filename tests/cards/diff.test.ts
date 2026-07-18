import { describe, it, expect } from 'vitest';
import { diffCards, isEmptyDiff, buildReport, type CardDef } from '@cards/index';
import { cardId } from '@shared/index';

const base: CardDef[] = [
  { id: cardId('a'), name: 'A', cost: 1, text: 'Deal 1 damage.' },
  { id: cardId('b'), name: 'B', cost: 2, text: 'Gain 2 block.' },
];

describe('diffCards', () => {
  it('reports no changes when identical', () => {
    const diff = diffCards(base, base.slice());
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it('detects an added card', () => {
    const current = [...base, { id: cardId('c'), name: 'C', cost: 0, text: 'Draw 1 cards.' }];
    const diff = diffCards(base, current);
    expect(diff.added.map((c) => c.id)).toEqual(['c']);
    expect(diff.modified).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('detects a removed card', () => {
    const diff = diffCards(base, [base[0]!]);
    expect(diff.removed.map((c) => c.id)).toEqual(['b']);
  });

  it('detects a modified card and which fields changed', () => {
    const current: CardDef[] = [
      { ...base[0]!, text: 'Deal 6 damage.', cost: 2 },
      base[1]!,
    ];
    const diff = diffCards(base, current);
    expect(diff.modified).toHaveLength(1);
    const m = diff.modified[0]!;
    expect(m.id).toBe('a');
    expect([...m.changedFields].sort()).toEqual(['cost', 'text']);
    expect(m.before.text).toBe('Deal 1 damage.');
    expect(m.after.text).toBe('Deal 6 damage.');
  });

  it('builds a self-describing, serializable report', () => {
    const current = [...base, { id: cardId('c'), name: 'C', cost: 0, text: 'Draw 1 cards.' }];
    const report = buildReport(diffCards(base, current), '2026-07-18T00:00:00.000Z');
    expect(report.kind).toBe('wizardcards.card-diff');
    expect(report.summary).toEqual({ added: 1, modified: 0, removed: 0 });
    expect(report.generatedAt).toBe('2026-07-18T00:00:00.000Z');
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
