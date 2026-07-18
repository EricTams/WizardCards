import { describe, it, expect } from 'vitest';
import { tokenize } from '@cards/index';

describe('tokenizer', () => {
  it('splits words, numbers, and punctuation with spans', () => {
    const tokens = tokenize('Deal 6 damage.');
    expect(tokens).toEqual([
      { type: 'word', value: 'Deal', start: 0, end: 4 },
      { type: 'number', value: '6', start: 5, end: 6 },
      { type: 'word', value: 'damage', start: 7, end: 13 },
      { type: 'punctuation', value: '.', start: 13, end: 14 },
    ]);
  });

  it('flags unknown characters instead of throwing', () => {
    const tokens = tokenize('Deal ~ damage');
    expect(tokens.some((t) => t.type === 'unknown' && t.value === '~')).toBe(true);
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   \n\t ')).toEqual([]);
  });
});
