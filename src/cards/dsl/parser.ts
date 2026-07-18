/**
 * Parser: tokens -> CardScript AST (+ diagnostics).
 *
 * A deliberately tiny grammar for the skeleton. Each statement is:
 *
 *     <verb> <number> <noun> ["."]
 *
 * with verb in {deal, gain, draw}. Statements are separated by sentence
 * punctuation. Anything unrecognized yields a Diagnostic with a source span
 * instead of throwing, so the Card Lab can underline the offending text.
 *
 * The grammar WILL grow (targets, conditions, triggers). The contract that
 * matters now: pure function, Result out, positional diagnostics.
 */
import { type Diagnostic, type Result, ok, err } from '@shared/index';
import { tokenize, type Token } from '@cards/dsl/tokenizer';
import type { CardScript, EffectNode, Verb } from '@cards/dsl/ast';

const VERBS: Record<string, Verb> = {
  deal: 'deal',
  gain: 'gain',
  draw: 'draw',
};

export function parse(source: string): Result<CardScript, Diagnostic[]> {
  const tokens = tokenize(source).filter(
    (t) => !(t.type === 'punctuation' && t.value === '.'),
  );
  const effects: EffectNode[] = [];
  const diagnostics: Diagnostic[] = [];

  let i = 0;
  const at = (n = 0): Token | undefined => tokens[i + n];

  while (i < tokens.length) {
    const verbTok = at();
    if (!verbTok) break;

    const verb = verbTok.type === 'word' ? VERBS[verbTok.value.toLowerCase()] : undefined;
    if (!verb) {
      diagnostics.push(diag(`Expected a verb (deal/gain/draw), found "${verbTok.value}".`, verbTok));
      i++;
      continue;
    }

    const amountTok = at(1);
    if (!amountTok || amountTok.type !== 'number') {
      diagnostics.push(diag(`Expected a number after "${verbTok.value}".`, amountTok ?? verbTok));
      i++;
      continue;
    }

    const nounTok = at(2);
    if (!nounTok || nounTok.type !== 'word') {
      diagnostics.push(diag(`Expected a noun after "${amountTok.value}".`, nounTok ?? amountTok));
      i += 2;
      continue;
    }

    effects.push({
      kind: 'Effect',
      verb,
      amount: Number(amountTok.value),
      noun: nounTok.value.toLowerCase(),
      start: verbTok.start,
      end: nounTok.end,
    });
    i += 3;
  }

  if (diagnostics.length > 0) return err(diagnostics);
  return ok({ kind: 'CardScript', effects });
}

function diag(message: string, tok: Token): Diagnostic {
  return { severity: 'error', message, start: tok.start, end: tok.end };
}
