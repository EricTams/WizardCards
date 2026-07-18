/**
 * AST node types for the card language.
 *
 * A card's English text parses into an ordered list of Effect statements. This
 * is deliberately tiny for the skeleton — the point is the SHAPE of the pipeline
 * (text -> tokens -> AST -> resolved actions), not the eventual grammar.
 */

export type Verb = 'deal' | 'gain' | 'draw';

/** e.g. "Deal 6 damage." / "Gain 5 block." / "Draw 2 cards." */
export interface EffectNode {
  readonly kind: 'Effect';
  readonly verb: Verb;
  readonly amount: number;
  /** The noun the verb acts on: "damage", "block", "cards", … */
  readonly noun: string;
  /** Source span [start, end) so tools can map a node back to the text. */
  readonly start: number;
  readonly end: number;
}

export interface CardScript {
  readonly kind: 'CardScript';
  readonly effects: readonly EffectNode[];
}
