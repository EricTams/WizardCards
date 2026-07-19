/**
 * The keyword glossary — plain-language explanations of the game's mechanics,
 * surfaced in card tooltips. UI help content (not engine logic); a keyword is
 * shown for a card when one of its `match` terms appears in the card's text.
 */
export interface KeywordDef {
  readonly term: string;
  readonly description: string;
  /** Lowercased substrings in a card's text that make this keyword relevant. */
  readonly match: readonly string[];
}

export const GLOSSARY: readonly KeywordDef[] = [
  {
    term: 'Block',
    description: 'Temporary armor: soaks damage, then clears at the start of your next turn.',
    match: ['block'],
  },
  {
    term: 'Shield',
    description: 'Persistent armor: soaks damage and stays until it is used up (unlike Block, it is not cleared each turn).',
    match: ['shield'],
  },
  {
    term: 'Heal',
    description: 'Restore HP, up to your maximum.',
    match: ['heal'],
  },
  {
    term: 'Energy',
    description: 'You spend 1 energy to play a card. Extra energy lets you play more cards this turn.',
    match: ['energy'],
  },
  {
    term: 'Draw',
    description: 'Draw cards from your draw pile into your hand.',
    match: ['draw'],
  },
  {
    term: 'Discard',
    description: 'Put cards from your hand into your discard pile.',
    match: ['discard'],
  },
  {
    term: 'Poison',
    description: "The Wizard's stored X-value. “Poison N” raises it; Venom and Drink spend it.",
    match: ['poison'],
  },
  {
    term: 'Venom',
    description: 'Deal damage equal to your Poison, then set Poison to 0.',
    match: ['venom'],
  },
  {
    term: 'Drink',
    description: 'Gain Block equal to your Poison, then set Poison to 0.',
    match: ['drink'],
  },
  {
    term: 'Minion',
    description: 'Its effect happens when played; it then stays in play and replays that effect at the start of each of your turns.',
    match: ['minion'],
  },
  {
    term: 'Lightning Cloud',
    description: 'At the start of your turn, gain 1 energy for each Lightning Cloud you have.',
    match: ['lightning'],
  },
  {
    term: 'Storm Cloud',
    description: 'At the start of your turn, deal 1 damage to a random opponent for each Storm Cloud.',
    match: ['storm'],
  },
  {
    term: 'Snow Cloud',
    description: 'At the start of your turn, heal 1 for each Snow Cloud.',
    match: ['snow'],
  },
  {
    term: 'Fog Cloud',
    description: 'At the start of your turn, draw 1 for each Fog Cloud; at the end of your turn, discard 1.',
    match: ['fog'],
  },
  {
    term: 'Remove clouds',
    description: 'Send clouds (your choice) to your discard pile.',
    match: ['remove'],
  },
  {
    term: 'Power',
    description: 'The first time you attack each turn, deal this much extra damage.',
    match: ['power'],
  },
  {
    term: 'Bravery',
    description: 'The first Block card you play gives this much additional Block.',
    match: ['bravery'],
  },
];

/** The glossary entries relevant to a card's text (in glossary order). */
export function keywordsInText(text: string): KeywordDef[] {
  const t = text.toLowerCase();
  return GLOSSARY.filter((k) => k.match.some((m) => t.includes(m)));
}
