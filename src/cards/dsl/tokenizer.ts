/**
 * Tokenizer (lexer): raw English card text -> a flat list of tokens.
 *
 * Pure and total. Every token carries its source span so downstream stages and
 * the Card Lab can highlight exactly where each token came from. Unknown
 * characters become 'unknown' tokens rather than throwing — the parser decides
 * what's actually an error.
 */

export type TokenType = 'word' | 'number' | 'punctuation' | 'unknown';

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

const WORD = /[A-Za-z][A-Za-z'-]*/y;
const NUMBER = /[0-9]+/y;
const WHITESPACE = /\s+/y;
const PUNCTUATION = /[.,;:!?()]/y;

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  const tryMatch = (re: RegExp): string | null => {
    re.lastIndex = pos;
    const m = re.exec(source);
    return m && m.index === pos ? m[0] : null;
  };

  while (pos < source.length) {
    const ws = tryMatch(WHITESPACE);
    if (ws !== null) {
      pos += ws.length;
      continue;
    }

    const start = pos;
    let value: string | null;

    if ((value = tryMatch(NUMBER)) !== null) {
      tokens.push({ type: 'number', value, start, end: start + value.length });
    } else if ((value = tryMatch(WORD)) !== null) {
      tokens.push({ type: 'word', value, start, end: start + value.length });
    } else if ((value = tryMatch(PUNCTUATION)) !== null) {
      tokens.push({ type: 'punctuation', value, start, end: start + value.length });
    } else {
      value = source[pos]!;
      tokens.push({ type: 'unknown', value, start, end: start + 1 });
    }

    pos += value.length;
  }

  return tokens;
}
