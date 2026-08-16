import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CARDS, PERSISTENT_CARDS, RELICS, RELIC_ART, CHARACTERS } from '@cards/index';
import { cardArtPath } from '@ui/game/art';

/**
 * Art coverage.
 *
 * Every art path in the game is built from a *name* — a card's `name` becomes
 * `Old Lady Cards-<name>.png`, a relic's becomes `Relics-<name>.png` — so a
 * rename that looks harmless silently orphans the art and ships a broken image.
 * These tests are the guard: they check the files are really on disk.
 */
const ASSETS = join(import.meta.dirname, '..', '..', 'assets');
const has = (path: string) => existsSync(join(ASSETS, path));

describe('card faces', () => {
  const drawn = ALL_CARDS.filter((c) => cardArtPath(c) !== null);

  /**
   * Cards whose face was never drawn. Listing them makes the gap deliberate —
   * the test still fails the moment a *different* card loses its art. Consuming
   * has a Persistent status icon but no card face, so it only shows unfaced in
   * the Card Lab (persistents aren't dealt into decks).
   */
  const KNOWN_MISSING = ['wizard-consuming'];

  it('covers every card of every character that has art', () => {
    const missing = drawn
      .filter((c) => !has(cardArtPath(c)!))
      .filter((c) => !KNOWN_MISSING.includes(c.id as string))
      .map((c) => `${c.id} → ${cardArtPath(c)}`);
    expect(missing).toEqual([]);
  });

  it('the known-missing list is not stale', () => {
    const stillMissing = KNOWN_MISSING.filter((id) => {
      const card = ALL_CARDS.find((c) => (c.id as string) === id);
      return card && !has(cardArtPath(card)!);
    });
    expect(stillMissing).toEqual(KNOWN_MISSING);
  });

  it('leaves the Knight without art rather than pointing at a 404', () => {
    const knight = ALL_CARDS.filter((c) => (c.id as string).startsWith('knight-'));
    expect(knight.length).toBeGreaterThan(0);
    expect(knight.every((c) => cardArtPath(c) === null)).toBe(true);
    expect(CHARACTERS.knight.playable).toBe(false);
  });
});

describe('persistent status icons', () => {
  // The folder + prefix mirror `persistentIconUrl`; a character with no icons
  // drawn simply isn't listed here, and the UI falls back to the card's name.
  const LABELS: Record<string, string> = {
    cloud: 'Cloud',
    wizard: 'Wizard',
    crab: 'Crab',
    oldLady: 'Old Lady',
    writer: 'Writer',
  };

  it('covers every authored persistent of every drawn character', () => {
    const missing = PERSISTENT_CARDS.flatMap((c) => {
      const key = (c.id as string).split('-')[0] ?? '';
      const label = LABELS[key];
      if (!label) return []; // the Knight — no icons drawn yet
      const path = `art/status/${key}/${label} - Persistent Icons-${c.name}.png`;
      return has(path) ? [] : [`${c.id} → ${path}`];
    });
    expect(missing).toEqual([]);
  });
});

describe('relic icons', () => {
  it('every relic listed in RELIC_ART really has its icon', () => {
    const missing = [...RELIC_ART].filter((name) => !has(`art/relic/Relics-${name}.png`));
    expect(missing).toEqual([]);
  });

  it('every offered relic is either in RELIC_ART or knowingly iconless', () => {
    // A relic outside RELIC_ART renders a glyph instead — fine, but it must be
    // a deliberate gap, so assert the set of them rather than letting it drift.
    const iconless = RELICS.filter((r) => !RELIC_ART.has(r.name)).map((r) => r.name).sort();
    expect(iconless).toEqual(['Candle', 'Earring', 'Notebook', 'Pencil']);
  });
});

describe('level art', () => {
  it('covers every playable character, backdrop and platform', () => {
    const LABELS: Record<string, string> = {
      cloud: 'Cloud',
      wizard: 'Wizard',
      crab: 'Crab',
      oldLady: 'Old Lady',
      writer: 'Writer',
    };
    const missing = Object.values(CHARACTERS)
      .filter((c) => c.playable)
      .flatMap((c) => {
        const label = LABELS[c.id]!;
        return [`art/level/${c.id}/Level BG-${label}.png`, `art/level/${c.id}/Levels-${label}.png`].filter(
          (p) => !has(p),
        );
      });
    expect(missing).toEqual([]);
  });
});
