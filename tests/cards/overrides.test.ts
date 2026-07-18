import { describe, it, expect } from 'vitest';
import { applyOverrides, hasNoOverrides, EMPTY_OVERRIDES, type CardDef } from '@cards/index';
import { cardId } from '@shared/index';

const base: CardDef[] = [
  { id: cardId('a'), name: 'A', cost: 1, text: 'Deal 1 damage.' },
  { id: cardId('b'), name: 'B', cost: 2, text: 'Gain 2 block.' },
];

describe('applyOverrides', () => {
  it('returns the baseline unchanged for empty overrides', () => {
    expect(applyOverrides(base, EMPTY_OVERRIDES)).toEqual(base);
    expect(hasNoOverrides(EMPTY_OVERRIDES)).toBe(true);
  });

  it('replaces an edited card in place, preserving order', () => {
    const edited: CardDef = { id: cardId('a'), name: 'A+', cost: 1, text: 'Deal 5 damage.' };
    const result = applyOverrides(base, { version: 1, edited: { a: edited }, removed: [] });
    expect(result[0]).toEqual(edited);
    expect(result[1]).toEqual(base[1]);
  });

  it('drops removed cards', () => {
    const result = applyOverrides(base, { version: 1, edited: {}, removed: ['a'] });
    expect(result.map((c) => c.id)).toEqual(['b']);
  });

  it('appends brand-new cards', () => {
    const fresh: CardDef = { id: cardId('c'), name: 'C', cost: 0, text: 'Draw 1 cards.' };
    const result = applyOverrides(base, { version: 1, edited: { c: fresh }, removed: [] });
    expect(result.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('removed wins over edited for the same id', () => {
    const edited: CardDef = { id: cardId('a'), name: 'A+', cost: 1, text: 'Deal 9 damage.' };
    const result = applyOverrides(base, { version: 1, edited: { a: edited }, removed: ['a'] });
    expect(result.map((c) => c.id)).toEqual(['b']);
  });
});
