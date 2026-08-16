import { describe, it, expect } from 'vitest';
import { keywordsInText } from '@ui/game/keywords';
import { DUNGEON_NESS, PINCH } from '@cards/definitions/crab';
import { SHARP_STRIKE, SWORDS_AT_THE_READY, RETIREMENT, PAPER } from '@cards/definitions/old-lady';
import { BEHEAD, HELMET, HEALING_POTION } from '@cards/definitions/knight';
import { SAFETY_SPELL } from '@cards/definitions/wizard';
import { TYPE, QUILL, PEN_STAB } from '@cards/definitions/writer';

/**
 * The glossary matches on plain substrings, which is fine for distinctive words
 * (`molt`, `craft`) and a trap for short ones. These tests pin the traps: `add`
 * is also a verb, and three of the four Markings are also ordinary card words.
 */
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

describe('keyword glossary matching', () => {
  it('shows Add only for cards that actually carry the keyword', () => {
    expect(terms(SWORDS_AT_THE_READY.text)).toContain('Add');
    expect(terms(RETIREMENT.text)).toContain('Add'); // "Put add on 1 card…"
    // "Gain 3 shields. Add molt to 1 card in your hand." — the verb, not the keyword.
    expect(terms(DUNGEON_NESS.text)).not.toContain('Add');
    // "Deal 4 damage. Gain 1 energy. Add fading to 1 card in your hand."
    expect(terms('Add fading to 1 card in your hand.')).not.toContain('Add');
  });

  it('shows a Marking only where a card is being marked', () => {
    expect(terms(BEHEAD.text)).toContain('Sharp');
    expect(terms(HEALING_POTION.text)).toContain('Safe');
    // Same word, different meaning — these are card names and unrelated text.
    expect(terms(SHARP_STRIKE.text)).not.toContain('Sharp');
    expect(terms(SAFETY_SPELL.text)).not.toContain('Safe');
    expect(terms(HELMET.text)).toEqual(['Shield']);
  });

  it('still shows the distinctive keywords', () => {
    expect(terms(PINCH.text)).toContain('Molt');
    expect(terms(PAPER.text)).toContain('Blank');
    expect(terms(QUILL.text)).toEqual(expect.arrayContaining(['Shield', 'Craft', 'Fading']));
    expect(terms(TYPE.text)).toEqual(expect.arrayContaining(['Craft', 'Burn', 'Fading']));
    expect(terms(PEN_STAB.text)).toContain('Craft');
  });
});
