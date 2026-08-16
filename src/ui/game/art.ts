/**
 * Art resolution for the game view.
 *
 * The hand-drawn art lives in `assets/art/…`, served at `<base>art/…` (Vite's
 * `publicDir` — see vite.config.ts). This module maps game entities to those
 * files and carries the sprite-sheet metadata the animated `<Sprite>` needs.
 *
 * IMPORTANT: only card art, heroes, cloud/minion tokens, and status icons come
 * from art here. Every *numeric UI value* (HP, energy, block, …) is a plain HTML
 * element in the battle screen, never a sprite.
 */
import type { CharacterId, CloudType } from '@shared/index';

const BASE = import.meta.env.BASE_URL;

/** Build a served URL from an `art/…` path, encoding spaces in file names. */
function artUrl(path: string): string {
  return BASE + path.split('/').map(encodeURIComponent).join('/');
}

/** A horizontal sprite sheet: `frames` cells of `frameW×frameH`, left to right. */
export interface Sprite {
  readonly url: string;
  readonly frameW: number;
  readonly frameH: number;
  readonly frames: number;
  /** CSS `@keyframes` name that scrolls the sheet (see `SPRITE_CSS`). */
  readonly anim: string;
  readonly durationMs: number;
}

function sheet(path: string, frameW: number, frameH: number, frames: number, durationMs: number): Sprite {
  return { url: artUrl(path), frameW, frameH, frames, anim: `spr_${frameW}_${frames}`, durationMs };
}

export type HeroPose = 'idle' | 'damage' | 'die' | 'play';

/**
 * The Cloud hero's animation set. Durations are hand-tuned rather than taken
 * from the sheet metadata (every frame is authored at a flat 100ms): the idle
 * reads better slowed right down, and death wants a beat per frame.
 */
const CLOUD_HERO: Record<HeroPose, Sprite> = {
  idle: sheet('art/character/cloud/Cloud-Idle.png', 96, 96, 2, 900),
  damage: sheet('art/character/cloud/Cloud-Damage.png', 96, 96, 6, 600),
  die: sheet('art/character/cloud/Cloud-Die.png', 96, 96, 5, 700),
  play: sheet('art/character/cloud/Cloud-Play Card.png', 96, 96, 2, 400),
};

/**
 * The Wizard's set. Drawn on a taller 112x112 canvas than the Cloud, with a
 * 3-frame hit instead of 6 — timings keep the Cloud's per-frame pacing so the
 * two heroes read at the same speed side by side.
 */
const WIZARD_HERO: Record<HeroPose, Sprite> = {
  idle: sheet('art/character/wizard/Wizard-Idle.png', 112, 112, 2, 900),
  damage: sheet('art/character/wizard/Wizard-Damage.png', 112, 112, 3, 300),
  die: sheet('art/character/wizard/Wizard-Die.png', 112, 112, 5, 700),
  play: sheet('art/character/wizard/Wizard-Play Card.png', 112, 112, 2, 400),
};

/** The Crab's set — the Wizard's canvas and pacing, with a 5-frame hit. */
const CRAB_HERO: Record<HeroPose, Sprite> = {
  idle: sheet('art/character/crab/Crab-Idle.png', 112, 112, 2, 900),
  damage: sheet('art/character/crab/Crab-Damage.png', 112, 112, 5, 500),
  die: sheet('art/character/crab/Crab-Die.png', 112, 112, 5, 700),
  play: sheet('art/character/crab/Crab-Play Card.png', 112, 112, 2, 400),
};

/** Characters with authored hero art; the rest fall back to a labelled box. */
const HEROES: Partial<Record<CharacterId, Record<HeroPose, Sprite>>> = {
  cloud: CLOUD_HERO,
  wizard: WIZARD_HERO,
  crab: CRAB_HERO,
};

/** Hero sprite for a character + pose, or `null` if that character has no art. */
export function heroSprite(character: CharacterId | undefined, pose: HeroPose): Sprite | null {
  return (character && HEROES[character]?.[pose]) ?? null;
}

const CLOUD_LABEL: Record<CloudType, string> = {
  lightning: 'Lightning',
  storm: 'Storm',
  snow: 'Snow',
  fog: 'Fog',
};

/** The small-cloud token sprite for a cloud type (48×48, 2-frame idle). */
export function cloudSprite(type: CloudType): Sprite {
  return sheet(`art/other/Small Clouds-${CLOUD_LABEL[type]}.png`, 48, 48, 2, 900);
}

/**
 * The hand that points at the card under the cursor — the fanned cards overlap,
 * so it disambiguates which one a click will play. A single static frame (the
 * finger points down), so it sits above the card.
 */
export const CARD_POINTER = sheet('art/other/Card Pointer-Hand.png', 32, 48, 1, 0);

/**
 * Card-art folders keyed by the character prefix every card id carries
 * (`crab-pinch` → `art/card/crab/Crab Cards-Pinch.png`). Unprefixed ids fall
 * back to the Cloud, which is where the first cards lived.
 */
const CARD_ART_FOLDERS: Record<string, { folder: string; prefix: string }> = {
  cloud: { folder: 'cloud', prefix: 'Cloud Cards' },
  wizard: { folder: 'wizard', prefix: 'Wizard Cards' },
  crab: { folder: 'crab', prefix: 'Crab Cards' },
  writer: { folder: 'writer', prefix: 'Writer Cards' },
  oldLady: { folder: 'oldLady', prefix: 'Old Lady Cards' },
};

/**
 * Where a card's face lives under `assets/`, or `null` for a character whose
 * faces aren't drawn yet (the Knight).
 *
 * Split out from `cardArtUrl` so the art-coverage test can check the file is
 * really there without depending on `BASE_URL` — the file name is built from the
 * card's **name**, so renaming a card silently orphans its art otherwise.
 */
export function cardArtPath(card: { readonly id: string; readonly name: string }): string | null {
  const key = card.id.split('-')[0] ?? '';
  const folder = CARD_ART_FOLDERS[key];
  if (!folder) return null;
  return `art/card/${folder.folder}/${folder.prefix}-${card.name}.png`;
}

/**
 * The card-face art for a card, or `''` for a character whose faces aren't drawn
 * yet. An empty src leaves the card's tinted panel and its HTML name/cost tags,
 * which read fine on their own — better than pointing at a 404 and getting the
 * browser's broken-image glyph.
 */
export function cardArtUrl(card: { readonly id: string; readonly name: string }): string {
  const path = cardArtPath(card);
  return path ? artUrl(path) : '';
}

/**
 * The two-layer battle scene: a full-bleed backdrop (sky/horizon) with a
 * foreground platform frame drawn over it, both authored per character. Missing
 * layers fall back to the CSS gradient the screen already carries.
 */
export interface LevelArt {
  readonly backdrop: string;
  readonly platform: string;
}

const LEVEL_LABELS: Partial<Record<CharacterId, string>> = {
  cloud: 'Cloud',
  wizard: 'Wizard',
  crab: 'Crab',
  oldLady: 'Old Lady',
  writer: 'Writer',
};

export function levelArt(character: CharacterId | undefined): LevelArt | null {
  const label = character && LEVEL_LABELS[character];
  if (!character || !label) return null;
  return {
    backdrop: artUrl(`art/level/${character}/Level BG-${label}.png`),
    platform: artUrl(`art/level/${character}/Levels-${label}.png`),
  };
}

/** A relic's 48×48 icon, by relic name (`Relics-Old Shield.png`). */
export function relicIconUrl(name: string): string {
  return artUrl(`art/relic/Relics-${name}.png`);
}

/** Characters whose Persistent cards have a status icon drawn for the HUD. */
const STATUS_LABELS: Partial<Record<CharacterId, string>> = {
  cloud: 'Cloud',
  wizard: 'Wizard',
  crab: 'Crab',
  oldLady: 'Old Lady',
  writer: 'Writer',
};

/** The small icon for a Persistent in play, or `''` when none is drawn. */
export function persistentIconUrl(character: CharacterId | undefined, name: string): string {
  const label = character && STATUS_LABELS[character];
  if (!label) return '';
  return artUrl(`art/status/${character}/${label} - Persistent Icons-${name}.png`);
}

/** The card-face's native pixel size (all cards share one canvas). */
export const CARD_ART_W = 96;
export const CARD_ART_H = 144;

/**
 * `@keyframes` for every sprite sheet we animate (injected once by the screen).
 * One entry per distinct frame-width × frame-count in use: 96 = Cloud hero,
 * 112 = Wizard/Crab heroes, 48 = cloud tokens. A sheet whose pair is missing
 * here renders its first frame and never scrolls.
 */
export const SPRITE_CSS = [
  [96, 2],
  [96, 5],
  [96, 6],
  [112, 2],
  [112, 3],
  [112, 5],
  [48, 2],
]
  .map(([w, n]) => `@keyframes spr_${w}_${n}{to{background-position-x:-${w! * n!}px}}`)
  .join('\n');
