/**
 * Parser: tokens -> CardScript AST (+ diagnostics).
 *
 * Two levels of structure:
 *   1. Sentences, split on "." and ";".
 *   2. Within a sentence, one of:
 *      - a TRIGGER  ("Whenever <event>[, if <condition>], <effect>[, <effect>…]")
 *                   opened by when/whenever/at,
 *      - a MODIFIER ("Snow clouds heal 2 instead of 1.", "Fog clouds no longer …"),
 *      - or a comma-separated list of immediate EFFECT statements.
 *
 * An effect statement is:
 *   deal N damage [to all opponents | to a random opponent]
 *   gain N (block|shield|energy|power|bravery) | heal N | poison N | draw N [cards]
 *   create N <cloud> cloud | remove N cloud | discard N minion
 *   venom | drink | minion
 *
 * Nouns match plural-insensitively. Anything unrecognized yields a Diagnostic
 * with a source span instead of throwing. Pure function, Result out.
 */
import { type Diagnostic, type Result, ok, err, type CloudType } from '@shared/index';
import { tokenize, type Token } from '@cards/dsl/tokenizer';
import type {
  CardScript,
  EffectNode,
  EffectTarget,
  ModifierNode,
  TriggerCondition,
  TriggerEventKind,
  TriggerNode,
  Verb,
} from '@cards/dsl/ast';
import type { ScaleMetric } from '@shared/index';

const SENTENCE_SEP = new Set(['.', ';']);
const CLAUSE_SEP = new Set([',', ':']);

const GAIN_RESOURCES = new Set(['block', 'shield', 'energy', 'power', 'bravery']);

const CLOUD_TYPES: Record<string, CloudType> = {
  lightning: 'lightning',
  storm: 'storm',
  snow: 'snow',
  fog: 'fog',
};

const KEYWORDS = new Set<Verb>(['venom', 'drink', 'minion']);
const TRIGGER_LEADS = new Set(['when', 'whenever', 'at']);

export function parse(source: string): Result<CardScript, Diagnostic[]> {
  const sentences = splitOn(tokenize(source), SENTENCE_SEP);
  const effects: EffectNode[] = [];
  const triggers: TriggerNode[] = [];
  const modifiers: ModifierNode[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const sentence of sentences) {
    const head = sentence[0];
    if (!head || head.type !== 'word') {
      if (head) diagnostics.push(diag(`Expected a verb or trigger, found "${head.value}".`, head));
      continue;
    }
    const lead = head.value.toLowerCase();

    if (TRIGGER_LEADS.has(lead)) {
      const trigger = parseTrigger(sentence, diagnostics);
      if (trigger) triggers.push(trigger);
    } else if (isClawSentence(sentence)) {
      modifiers.push({ kind: 'Modifier', modifier: 'claw', start: head.start, end: sentence[sentence.length - 1]!.end });
    } else if (isModifierSentence(sentence)) {
      const modifier = parseModifier(sentence, diagnostics);
      if (modifier) modifiers.push(modifier);
    } else {
      for (const clause of splitOn(sentence, CLAUSE_SEP)) {
        const effect = parseEffectStatement(clause, diagnostics);
        if (effect) effects.push(effect);
      }
    }
  }

  if (diagnostics.length > 0) return err(diagnostics);
  return ok({ kind: 'CardScript', effects, triggers, modifiers });
}

/** Split a flat token list into groups on the given separator punctuation. */
function splitOn(tokens: readonly Token[], seps: ReadonlySet<string>): Token[][] {
  const groups: Token[][] = [];
  let current: Token[] = [];
  for (const tok of tokens) {
    if (tok.type === 'punctuation' && seps.has(tok.value)) {
      if (current.length > 0) groups.push(current);
      current = [];
    } else {
      current.push(tok);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

// --- triggers ----------------------------------------------------------------

function parseTrigger(sentence: Token[], diagnostics: Diagnostic[]): TriggerNode | null {
  const clauses = splitOn(sentence, CLAUSE_SEP);
  const phrase = clauses[0]!;
  const parsed = parseEventPhrase(phrase, diagnostics);
  if (!parsed) return null;

  let condition: TriggerCondition | undefined;
  const effects: EffectNode[] = [];
  for (const clause of clauses.slice(1)) {
    if (clause[0]?.type === 'word' && clause[0].value.toLowerCase() === 'if') {
      condition = parseCondition(clause, diagnostics) ?? condition;
    } else {
      const effect = parseEffectStatement(clause, diagnostics);
      if (effect) effects.push(effect);
    }
  }

  if (effects.length === 0) {
    diagnostics.push(diag('A trigger needs at least one effect after the comma.', phrase[0]!));
    return null;
  }

  const last = sentence[sentence.length - 1]!;
  return {
    kind: 'Trigger',
    event: parsed.event,
    ...(parsed.cloudType ? { cloudType: parsed.cloudType } : {}),
    ...(condition ? { condition } : {}),
    effects,
    start: sentence[0]!.start,
    end: last.end,
  };
}

/** Keyword-based recognition of the "when …" phrase (forgiving of wording). */
function parseEventPhrase(
  phrase: Token[],
  diagnostics: Diagnostic[],
): { event: TriggerEventKind; cloudType?: CloudType } | null {
  const words = phrase.filter((t) => t.type === 'word').map((t) => t.value.toLowerCase());
  const has = (w: string) => words.includes(w);

  if (has('start')) return { event: 'startTurn' };
  if (has('end')) return { event: 'endTurn' };
  if (has('create') && (has('cloud') || has('clouds'))) return { event: 'createCloud' };
  if ((has('cloud') || has('clouds')) && has('removed')) {
    const cloudType = words.map((w) => CLOUD_TYPES[w]).find(Boolean);
    return cloudType ? { event: 'removeCloud', cloudType } : { event: 'removeCloud' };
  }
  if (has('unblocked') && has('damage')) return { event: 'dealUnblockedDamage' };
  if ((has('minion') || has('minions')) && has('replayed')) return { event: 'minionReplayed' };
  // Card discards. The Claw-qualified form is the narrower reading of the same
  // words, so it has to be tested first.
  if (has('shuffle') || has('shuffled')) return { event: 'shuffleDeck' };
  if ((has('card') || has('cards')) && (has('discard') || has('discarded'))) {
    return has('claw') ? { event: 'discardClawCard' } : { event: 'discardCard' };
  }
  if ((has('minion') || has('minions')) && (has('discarded') || has('discard')))
    return { event: 'discardMinion' };

  diagnostics.push(diag(`Unrecognized trigger "${phrase.map((t) => t.value).join(' ')}".`, phrase[0]!));
  return null;
}

/** Parse "if you have over N <resource>" style gates. */
function parseCondition(clause: Token[], diagnostics: Diagnostic[]): TriggerCondition | null {
  const words = clause.filter((t) => t.type === 'word').map((t) => t.value.toLowerCase());
  const numberTok = clause.find((t) => t.type === 'number');
  if (!numberTok) {
    diagnostics.push(diag('Expected a number in the condition.', clause[0]!));
    return null;
  }
  const resource = words.find((w) => RESOURCE_WORDS.has(w));
  if (!resource) {
    diagnostics.push(diag('Condition needs a resource (energy, block, poison, …).', clause[0]!));
    return null;
  }
  // "over N" / "more than N" are strict; "N or more" / "N or greater" include N.
  // The `or` is what separates them — without it, the documented inclusive form
  // matched on `more` and compiled to a strict >, so a card asking for "5 or
  // more block" quietly ignored exactly 5.
  const inclusive = words.includes('or');
  const below = words.includes('fewer') || words.includes('less') || words.includes('under');
  if (below) {
    // "fewer than N" is strict; "N or fewer" includes N — same `or` rule.
    return { resource: normalizeResource(resource), op: inclusive ? 'lte' : 'lt', amount: Number(numberTok.value) };
  }
  const strict = !inclusive && (words.includes('over') || words.includes('more') || words.includes('greater'));
  return { resource: normalizeResource(resource), op: strict ? 'gt' : 'gte', amount: Number(numberTok.value) };
}

const RESOURCE_WORDS = new Set([
  'energy', 'block', 'shield', 'shields', 'defense', 'poison', 'power', 'bravery', 'hp', 'health', 'hearts',
  // Countable things a condition can gate on, not just resources.
  'hand', 'discarded',
]);

function normalizeResource(word: string): string {
  if (word === 'health' || word === 'hearts') return 'hp';
  // "…cards in hand" gates on hand size; "…discarded N cards" on the turn count.
  if (word === 'hand') return 'handSize';
  if (word === 'discarded') return 'cardsDiscardedThisTurn';
  return singular(word);
}

// --- modifiers ---------------------------------------------------------------

/**
 * `Claw.` on its own — the Crab's keyword, marking the card as one that plays
 * for free when discarded. A whole sentence so it can't be confused with a verb.
 */
function isClawSentence(sentence: Token[]): boolean {
  return sentence.length === 1 && sentence[0]!.type === 'word' && sentence[0]!.value.toLowerCase() === 'claw';
}

function isModifierSentence(sentence: Token[]): boolean {
  const first = sentence[0]?.value.toLowerCase();
  const second = sentence[1]?.value.toLowerCase();
  // "Minions are replayed 1 additional time." — must check for `replayed`, not
  // just the leading word, or the bare `Minion.` keyword gets swallowed here.
  if (
    (first === 'minions' || first === 'minion') &&
    sentence.some((t) => t.type === 'word' && t.value.toLowerCase() === 'replayed')
  ) {
    return true;
  }
  return !!first && CLOUD_TYPES[first] !== undefined && (second === 'clouds' || second === 'cloud');
}

function parseModifier(sentence: Token[], diagnostics: Diagnostic[]): ModifierNode | null {
  const words = sentence.filter((t) => t.type === 'word').map((t) => t.value.toLowerCase());
  const span = { start: sentence[0]!.start, end: sentence[sentence.length - 1]!.end };
  const negated = words.includes('no') || words.includes('not') || words.includes('never') || words.includes('longer');

  if ((words.includes('minions') || words.includes('minion')) && words.includes('replayed')) {
    const numbers = sentence.filter((t) => t.type === 'number').map((t) => Number(t.value));
    return { kind: 'Modifier', modifier: 'minionReplayBonus', amount: numbers[0] ?? 1, ...span };
  }
  if (words.includes('discard') && negated) {
    return { kind: 'Modifier', modifier: 'suppressFogDiscard', ...span };
  }
  if (words.includes('heal')) {
    const numbers = sentence.filter((t) => t.type === 'number').map((t) => Number(t.value));
    if (words.includes('additional') || words.includes('extra')) {
      return { kind: 'Modifier', modifier: 'snowHealBonus', amount: numbers[0] ?? 1, ...span };
    }
    if (words.includes('instead') && numbers.length >= 2) {
      return { kind: 'Modifier', modifier: 'snowHealBonus', amount: numbers[0]! - numbers[1]!, ...span };
    }
  }
  diagnostics.push(diag(`Unrecognized cloud modifier "${sentence.map((t) => t.value).join(' ')}".`, sentence[0]!));
  return null;
}

// --- effect statements -------------------------------------------------------

function parseEffectStatement(clause: Token[], diagnostics: Diagnostic[]): EffectNode | null {
  const { target, rest } = extractTarget(clause);

  // Scaling ("equal to your energy" / "3 for each unique cloud") works on `deal`
  // and on the resource-granting verbs; anywhere else it is a diagnostic rather
  // than a silent miss.
  const scaled = rest.some((t) => t.type === 'word' && (t.value.toLowerCase() === 'equal' || t.value.toLowerCase() === 'each'));
  let effect: EffectNode | null;
  if (scaled) {
    const head = rest[0];
    const lead = head?.type === 'word' ? head.value.toLowerCase() : '';
    if (lead === 'deal' || lead === 'gain' || lead === 'poison') {
      effect = parseScaledDeal(rest, diagnostics);
    } else {
      diagnostics.push(diag('Scaling ("for each", "equal to") is only supported on "deal" for now.', head ?? rest[0]!));
      effect = null;
    }
  } else {
    effect = parseStatement(rest, diagnostics);
  }

  if (effect && target) return { ...effect, target };
  return effect;
}

const SCALE_RESOURCES = new Set<ScaleMetric>(['energy', 'poison', 'block', 'shield', 'defense', 'power', 'bravery']);

/**
 * Parse "<verb> … equal to your X" / "<verb> N … for each Y". Shared by `deal`
 * and the resource verbs, so the verb (and for `gain`, the resource noun) is
 * taken from the statement rather than assumed to be damage.
 */
function parseScaledDeal(group: Token[], diagnostics: Diagnostic[]): EffectNode | null {
  const head = group[0]!;
  const verb = head.value.toLowerCase() as Verb;
  const nounFor = (): string | undefined => {
    if (verb === 'deal') return 'damage';
    if (verb === 'poison') return 'poison';
    const w = group.filter((t) => t.type === 'word').map((t) => singular(t.value.toLowerCase()));
    return w.find((x) => GAIN_RESOURCES.has(x));
  };
  const words = group.filter((t) => t.type === 'word').map((t) => t.value.toLowerCase());
  const span = { start: head.start, end: group[group.length - 1]!.end };

  if (words.includes('equal')) {
    const resource = words.map((w) => singular(w)).find((w) => SCALE_RESOURCES.has(w as ScaleMetric));
    if (!resource) {
      diagnostics.push(diag('"equal to your …" needs a resource (energy, poison, block, shield, defense, power, bravery).', head));
      return null;
    }
    const n1 = nounFor();
    return { kind: 'Effect', verb, ...(n1 ? { noun: n1 } : {}), scale: { per: resource as ScaleMetric }, ...span };
  }

  // "for each …"
  // "Poison for each card played this turn" omits the per-unit amount; 1 is the
  // natural reading, matching how "equal to your X" means one-for-one.
  const numberTok = group.find((t) => t.type === 'number');
  if (!numberTok && verb === 'deal') {
    diagnostics.push(diag('"… for each …" needs a per-unit amount, e.g. "Deal 3 damage for each cloud".', head));
    return null;
  }
  const per = countMetric(words);
  if (!per) {
    diagnostics.push(diag('"for each …" needs cloud, unique cloud, minion, or card discarded this turn.', head));
    return null;
  }
  const n2 = nounFor();
  return {
    kind: 'Effect',
    verb,
    amount: numberTok ? Number(numberTok.value) : 1,
    ...(n2 ? { noun: n2 } : {}),
    scale: { per },
    ...span,
  };
}

const TYPED_CLOUD_METRICS: Record<string, ScaleMetric> = {
  lightning: 'lightningClouds',
  storm: 'stormClouds',
  snow: 'snowClouds',
  fog: 'fogClouds',
};

function countMetric(words: string[]): ScaleMetric | null {
  // Qualified counts first — each is a *narrower* reading of a word that also
  // matches a bare count below ("minion in your discard pile" vs "minion"), so
  // testing the bare form first would always win and silently count the wrong
  // thing.
  const cards = words.includes('card') || words.includes('cards');
  if (cards && words.includes('discarded')) return 'cardsDiscardedThisTurn';
  if (cards && words.includes('played')) return 'cardsPlayedThisTurn';
  const minions = words.includes('minion') || words.includes('minions');
  if (minions && words.includes('discard')) return 'minionsDiscarded';
  if (minions) return 'minions';
  if (words.includes('cloud') || words.includes('clouds')) {
    if (words.includes('unique')) return 'uniqueClouds';
    // "for each storm cloud" — a named type narrows the count to that kind.
    for (const [word, metric] of Object.entries(TYPED_CLOUD_METRICS)) {
      if (words.includes(word)) return metric;
    }
    return 'clouds';
  }
  return null;
}

/** Strip a trailing "to all opponents" / "to a random enemy" target phrase. */
function extractTarget(tokens: Token[]): { target?: EffectTarget; rest: Token[] } {
  const toIndex = tokens.findIndex((t) => t.type === 'word' && t.value.toLowerCase() === 'to');
  if (toIndex < 0) return { rest: tokens };
  const tail = tokens.slice(toIndex).map((t) => t.value.toLowerCase());
  const target: EffectTarget | undefined = tail.includes('all')
    ? 'allEnemies'
    : tail.includes('random')
      ? 'randomEnemy'
      : undefined;
  if (!target) return { rest: tokens };
  return { target, rest: tokens.slice(0, toIndex) };
}

function parseStatement(group: Token[], diagnostics: Diagnostic[]): EffectNode | null {
  const head = group[0];
  if (!head || head.type !== 'word') {
    if (head) diagnostics.push(diag(`Expected a verb, found "${head.value}".`, head));
    return null;
  }
  const verb = head.value.toLowerCase();
  const span = (from: Token, to: Token): Pick<EffectNode, 'start' | 'end'> => ({
    start: from.start,
    end: to.end,
  });

  if (KEYWORDS.has(verb as Verb)) {
    return { kind: 'Effect', verb: verb as Verb, ...span(head, head) };
  }

  switch (verb) {
    case 'deal':
      return needAmountNoun(group, 'deal', ['damage'], diagnostics);
    case 'gain': {
      const amount = expectNumber(group, 1, head, diagnostics);
      const resource = expectWord(group, 2, group[1] ?? head, diagnostics);
      if (amount === null || resource === null) return null;
      const noun = singular(resource.value);
      if (!GAIN_RESOURCES.has(noun)) {
        diagnostics.push(diag(`Can't gain "${resource.value}". Try block, shield, energy, power, or bravery.`, resource));
        return null;
      }
      return { kind: 'Effect', verb: 'gain', amount, noun, ...span(head, resource) };
    }
    case 'heal': {
      const amount = expectNumber(group, 1, head, diagnostics);
      if (amount === null) return null;
      const last = group[2] && group[2].type === 'word' ? group[2] : group[1]!;
      return { kind: 'Effect', verb: 'heal', amount, ...span(head, last) };
    }
    case 'poison': {
      const amount = expectNumber(group, 1, head, diagnostics);
      if (amount === null) return null;
      return { kind: 'Effect', verb: 'poison', amount, ...span(head, group[1]!) };
    }
    case 'draw': {
      const amount = expectNumber(group, 1, head, diagnostics);
      if (amount === null) return null;
      const last = group[2] && group[2].type === 'word' ? group[2] : group[1]!;
      return { kind: 'Effect', verb: 'draw', amount, noun: 'cards', ...span(head, last) };
    }
    case 'create': {
      const amount = expectNumber(group, 1, head, diagnostics);
      const typeTok = expectWord(group, 2, group[1] ?? head, diagnostics);
      if (amount === null || typeTok === null) return null;
      // "Create 1 random cloud" picks its type at reduce time, so it carries no
      // cloudType — the reducer draws one through the in-state RNG.
      if (typeTok.value.toLowerCase() === 'random') {
        const lastTok = group[3] && group[3].type === 'word' ? group[3] : typeTok;
        return { kind: 'Effect', verb: 'create', amount, noun: 'randomClouds', ...span(head, lastTok) };
      }
      const cloudType = CLOUD_TYPES[singular(typeTok.value)];
      if (!cloudType) {
        diagnostics.push(diag(`Unknown cloud type "${typeTok.value}". Try lightning, storm, snow, or fog.`, typeTok));
        return null;
      }
      const last = group[3] && group[3].type === 'word' ? group[3] : typeTok;
      return { kind: 'Effect', verb: 'create', amount, cloudType, noun: 'clouds', ...span(head, last) };
    }
    case 'remove': {
      // "Remove all clouds" carries no number, so it can't use the counted path.
      const last = group[group.length - 1]!;
      if (group.some((t) => t.type === 'word' && t.value.toLowerCase() === 'all')) {
        return { kind: 'Effect', verb: 'remove', noun: 'allClouds', ...span(head, last) };
      }
      if (group.some((t) => t.type === 'word' && t.value.toLowerCase() === 'random')) {
        const n = expectNumber(group, 1, head, diagnostics);
        if (n === null) return null;
        return { kind: 'Effect', verb: 'remove', amount: n, noun: 'randomClouds', ...span(head, last) };
      }
      return needAmountNoun(group, 'remove', ['cloud'], diagnostics);
    }
    case 'add': {
      // "Add claw to 2 cards in your hand." / "…to the top card of your draw pile."
      const last = group[group.length - 1]!;
      const words = group.filter((t) => t.type === 'word').map((t) => t.value.toLowerCase());
      if (!words.includes('claw')) {
        diagnostics.push(diag('Only "add claw to …" is supported.', head));
        return null;
      }
      if (words.includes('draw')) {
        return { kind: 'Effect', verb: 'add', noun: 'clawDrawTop', ...span(head, last) };
      }
      const numberTok = group.find((t) => t.type === 'number');
      return {
        kind: 'Effect',
        verb: 'add',
        amount: numberTok ? Number(numberTok.value) : 1,
        noun: 'clawHand',
        ...span(head, last),
      };
    }
    case 'return': {
      // "Return this card to your hand." — always the card being played.
      const last = group[group.length - 1]!;
      return { kind: 'Effect', verb: 'return', noun: 'thisCard', ...span(head, last) };
    }
    case 'shuffle': {
      // "Shuffle this card into your draw pile." vs "Shuffle your draw pile."
      const last = group[group.length - 1]!;
      const words = group.filter((t) => t.type === 'word').map((t) => t.value.toLowerCase());
      const noun = words.includes('this') ? 'thisCard' : 'drawPile';
      return { kind: 'Effect', verb: 'shuffle', noun, ...span(head, last) };
    }
    case 'move': {
      // "Move 1 card from your discard pile to your draw pile."
      const last = group[group.length - 1]!;
      const n = expectNumber(group, 1, head, diagnostics);
      if (n === null) return null;
      return { kind: 'Effect', verb: 'move', amount: n, noun: 'discardToDraw', ...span(head, last) };
    }
    case 'retain': {
      // "Retain your poison" arms the next Venom to keep it.
      const last = group[group.length - 1]!;
      return { kind: 'Effect', verb: 'retain', noun: 'poison', ...span(head, last) };
    }
    case 'double': {
      // Only "double your clouds next turn" (Solar Power) is understood today.
      const last = group[group.length - 1]!;
      const words = group.filter((t) => t.type === 'word').map((t) => t.value.toLowerCase());
      if (!words.includes('cloud') && !words.includes('clouds')) {
        diagnostics.push(diag('Only "double your clouds next turn" is supported.', head));
        return null;
      }
      return { kind: 'Effect', verb: 'double', noun: 'clouds', ...span(head, last) };
    }
    case 'fill': {
      // Only "fill all empty cloud slots [with random clouds]" is understood.
      const last = group[group.length - 1]!;
      const words = group.filter((t) => t.type === 'word').map((t) => t.value.toLowerCase());
      if (!words.includes('cloud') && !words.includes('clouds')) {
        diagnostics.push(diag('Only "fill all empty cloud slots with random clouds" is supported.', head));
        return null;
      }
      return { kind: 'Effect', verb: 'fill', noun: 'cloudSlots', ...span(head, last) };
    }
    case 'increase': {
      // Only "increase max clouds by N" is understood today.
      const last = group[group.length - 1]!;
      const words = group.filter((t) => t.type === 'word').map((t) => t.value.toLowerCase());
      const numberTok = group.find((t) => t.type === 'number');
      if (!words.includes('cloud') && !words.includes('clouds')) {
        diagnostics.push(diag('Only "increase max clouds by N" is supported.', head));
        return null;
      }
      if (!numberTok) {
        diagnostics.push(diag('"Increase max clouds" needs an amount, e.g. "increase max clouds by 1".', head));
        return null;
      }
      return {
        kind: 'Effect',
        verb: 'increase',
        noun: 'maxClouds',
        amount: Number(numberTok.value),
        ...span(head, last),
      };
    }
    case 'discard': {
      // "Discard your hand" takes no number, so it can't go through the
      // amount+noun path the counted forms use.
      const last = group[group.length - 1]!;
      if (group.some((t) => t.type === 'word' && t.value.toLowerCase() === 'hand')) {
        return { kind: 'Effect', verb: 'discard', noun: 'hand', ...span(head, last) };
      }
      if (group.some((t) => t.type === 'word' && t.value.toLowerCase() === 'all')) {
        return { kind: 'Effect', verb: 'discard', noun: 'allMinions', ...span(head, last) };
      }
      // "Discard 3 cards from your draw pile" — off the top, never from hand.
      if (group.some((t) => t.type === 'word' && t.value.toLowerCase() === 'draw')) {
        const n = expectNumber(group, 1, head, diagnostics);
        if (n === null) return null;
        return { kind: 'Effect', verb: 'discard', amount: n, noun: 'drawPile', ...span(head, last) };
      }
      // "Discard 1 card" (the Crab) and "Discard 1 minion" (the Wizard) share a
      // verb; the resolver picks the action from the noun.
      return needAmountNoun(group, 'discard', ['minion', 'card'], diagnostics);
    }
    default:
      diagnostics.push(diag(`Unknown verb "${head.value}".`, head));
      return null;
  }
}

function needAmountNoun(
  group: Token[],
  verb: Verb,
  allowedNouns: string[],
  diagnostics: Diagnostic[],
): EffectNode | null {
  const head = group[0]!;
  const amount = expectNumber(group, 1, head, diagnostics);
  const nounTok = expectWord(group, 2, group[1] ?? head, diagnostics);
  if (amount === null || nounTok === null) return null;
  const noun = singular(nounTok.value);
  if (!allowedNouns.includes(noun)) {
    diagnostics.push(diag(`Expected "${allowedNouns.join('" or "')}" after ${verb}, found "${nounTok.value}".`, nounTok));
    return null;
  }
  return { kind: 'Effect', verb, amount, noun, start: head.start, end: nounTok.end };
}

function expectNumber(group: Token[], index: number, prev: Token, diagnostics: Diagnostic[]): number | null {
  const tok = group[index];
  if (!tok || tok.type !== 'number') {
    diagnostics.push(diag(`Expected a number after "${prev.value}".`, tok ?? prev));
    return null;
  }
  return Number(tok.value);
}

function expectWord(group: Token[], index: number, prev: Token, diagnostics: Diagnostic[]): Token | null {
  const tok = group[index];
  if (!tok || tok.type !== 'word') {
    diagnostics.push(diag(`Expected a word after "${prev.value}".`, tok ?? prev));
    return null;
  }
  return tok;
}

/** Plural-insensitive noun matching: "clouds" -> "cloud", "shields" -> "shield". */
function singular(word: string): string {
  const w = word.toLowerCase();
  return w.endsWith('s') ? w.slice(0, -1) : w;
}

function diag(message: string, tok: Token): Diagnostic {
  return { severity: 'error', message, start: tok.start, end: tok.end };
}
