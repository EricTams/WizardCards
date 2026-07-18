import { describe, it, expect, beforeEach } from 'vitest';
import { EMPTY_OVERRIDES, type CardOverrides } from '@cards/index';
import { loadOverrides, saveOverrides, clearOverrides } from '@ui/cardlab/storage';
import { cardId } from '@shared/index';

/** Minimal localStorage stub so the ui persistence layer can be tested in Node. */
function installLocalStorage() {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe('card overrides persistence', () => {
  beforeEach(installLocalStorage);

  it('returns the empty overlay when nothing is stored', () => {
    expect(loadOverrides()).toEqual(EMPTY_OVERRIDES);
  });

  it('round-trips a saved overlay', () => {
    const overrides: CardOverrides = {
      version: 1,
      edited: { strike: { id: cardId('strike'), name: 'Strike+', cost: 1, text: 'Deal 9 damage.' } },
      removed: ['defend'],
    };
    saveOverrides(overrides);
    expect(loadOverrides()).toEqual(overrides);
  });

  it('recovers gracefully from corrupt data', () => {
    localStorage.setItem('wizardcards.cardOverrides.v1', '{not valid json');
    expect(loadOverrides()).toEqual(EMPTY_OVERRIDES);
  });

  it('clears stored overrides', () => {
    saveOverrides({ version: 1, edited: {}, removed: ['a'] });
    clearOverrides();
    expect(loadOverrides()).toEqual(EMPTY_OVERRIDES);
  });
});
