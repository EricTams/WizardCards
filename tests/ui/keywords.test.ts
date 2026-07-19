import { describe, it, expect } from 'vitest';
import { keywordsInText } from '@ui/game/keywords';

const terms = (text: string) => keywordsInText(text).map((k) => k.term);

describe('keyword glossary', () => {
  it('surfaces the keywords a card actually uses', () => {
    const t = terms('Venom, Gain 3 shields.');
    expect(t).toContain('Venom');
    expect(t).toContain('Shield');
    expect(t).not.toContain('Minion');
  });

  it('explains cloud types by name', () => {
    expect(terms('Create 2 storm clouds.')).toContain('Storm Cloud');
    expect(terms('Create 1 snow cloud. Draw 1 card.')).toEqual(expect.arrayContaining(['Snow Cloud', 'Draw']));
  });

  it('returns nothing when no keyword applies', () => {
    expect(keywordsInText('Deal 3 damage.')).toHaveLength(0);
  });
});
