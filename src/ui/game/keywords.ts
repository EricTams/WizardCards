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
    term: 'Defense',
    description: 'Your Block + Shield combined — some cards scale off your total defense.',
    match: ['defense'],
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
    description: 'The first Block or Shield you gain each turn is increased by your Bravery (it is not spent).',
    match: ['bravery'],
  },
  {
    term: 'Molt',
    description: 'When this card is discarded, it plays for free.',
    match: ['molt'],
  },
  {
    term: 'Craft',
    description: "The Writer's stored value. Unlike energy it does not reset each turn — Burn cards spend it.",
    // `burn` too: a Burn card never says "craft", but Craft is exactly what it
    // costs, so the tooltip has to explain the resource alongside the cost.
    match: ['craft', 'burn'],
  },
  {
    term: 'Burn',
    description: 'This card costs that much Craft instead of energy. Without enough Craft banked, you cannot play it.',
    match: ['burn'],
  },
  {
    term: 'Fading',
    description: 'If this card is still in your hand at the end of your turn, it is discarded.',
    match: ['fading'],
  },
  {
    term: 'Blank',
    description: 'This card has no effects. Playing it makes every Add card free to play, until you play a card that is neither Add nor Blank.',
    match: ['blank'],
  },
  {
    term: 'Add',
    // Matched on the keyword *sentence* and the granting phrase, not a bare
    // "add": the verb turns up all over the language ("Add molt to 2 cards",
    // "1 additional card") and would tag half the game with the Old Lady's rule.
    description: 'This card cannot be played normally — only after a Blank card has opened the window, and then for free.',
    match: ['add.', 'put add on'],
  },
  // The four Markings are matched on "with <marking>", the only phrasing that
  // actually marks a card — a bare "sharp" would tag Sharp Strike and Sharpen,
  // and a bare "safe" would tag Safety Spell.
  {
    term: 'Sharp',
    description: 'A Marking: when the marked card is played, deal that much damage to a random enemy. The marking is then lost.',
    match: ['with sharp'],
  },
  {
    term: 'Sturdy',
    description: 'A Marking: when the marked card is played, draw that many cards. The marking is then lost.',
    match: ['with sturdy'],
  },
  {
    term: 'Flaming',
    description: 'A Marking: when the marked card is played, gain that much energy. The marking is then lost.',
    match: ['with flaming'],
  },
  {
    term: 'Safe',
    description: 'A Marking: when the marked card is played, heal that much. The marking is then lost.',
    match: ['with safe'],
  },
];

/** The glossary entries relevant to a card's text (in glossary order). */
export function keywordsInText(text: string): KeywordDef[] {
  const t = text.toLowerCase();
  return GLOSSARY.filter((k) => k.match.some((m) => t.includes(m)));
}
