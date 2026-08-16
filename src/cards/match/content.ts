/**
 * Battle content — the character rosters, the relic list, and the enemy deck.
 *
 * This is the data a match is built from (`battle.ts` consumes it): which cards
 * make up a character's pool, what a relic does at combat start, and the deck the
 * opponent plays. It lives in the `cards` layer because it references CardDefs and
 * produces atomic actions; it never touches the UI.
 */
import type { Action } from '@engine/index';
import type { CardId, CharacterId, EntityId } from '@shared/index';
import type { CardDef } from '@cards/registry';
import { CLOUD_CARDS, CLOUD_ZAP, SUN_RAY, CRISSCROSS, SHINE, RAIN, HAZE, CLEANSE } from '@cards/definitions/cloud';
import { WIZARD_CARDS } from '@cards/definitions/wizard';
import { CRAB_CARDS } from '@cards/definitions/crab';
import { WRITER_CARDS } from '@cards/definitions/writer';

/** Base energy every combatant starts each turn with (design: "start with 1"). */
export const BASE_ENERGY = 1;
/** Starting/most HP a combatant has (design: "start with 20 Health"). */
export const BASE_MAX_HP = 20;
/** Cards in a starting deck (design: "a deck of 20 random cards"). */
export const DECK_SIZE = 20;
/** The opening draw, and how many of it you throw back (design: "draw 5, discard 2"). */
export const OPENING_HAND = 5;
export const OPENING_DISCARD = 2;
/** Base number of clouds a combatant may hold; creating more replaces existing ones. */
export const CLOUD_CAP = 3;
/**
 * "When you run out of cards, draw 3": the moment a combatant's hand hits zero
 * mid-battle, they draw this many (plus `bonusRefillDraw` — Brain Jar).
 * Orchestrated by the trigger cascade in `match/index.ts`.
 */
export const HAND_REFILL = 3;

/**
 * This combatant's actual cloud limit — the base cap plus any slots it has won
 * (Outburst, Spatial Reasoning). Use this rather than CLOUD_CAP anywhere the
 * limit is enforced or displayed, or a widened cap silently does nothing.
 */
export function cloudCapFor(c: { readonly bonusMaxClouds: number }): number {
  return CLOUD_CAP + c.bonusMaxClouds;
}

export interface CharacterDef {
  readonly id: CharacterId;
  readonly name: string;
  readonly blurb: string;
  /** The ~40-card pool a 20-card deck is drawn from (authored subset today). */
  readonly pool: readonly CardDef[];
  /** Background theme key the battle screen uses (the CSS fallback for level art). */
  readonly theme: 'field' | 'chamber' | 'beach' | 'study';
  /** False until the character has authored cards + art. */
  readonly playable: boolean;
}

/** The characters with an authored pool. `playable` gates the ones with art. */
export const CHARACTERS: Record<'cloud' | 'wizard' | 'crab' | 'writer', CharacterDef> = {
  cloud: {
    id: 'cloud',
    name: 'The Cloud',
    blurb: 'Conjures small clouds that trigger effects at the start of your turn.',
    pool: CLOUD_CARDS,
    theme: 'field',
    playable: true,
  },
  wizard: {
    id: 'wizard',
    name: 'The Wizard',
    blurb: 'Stores Poison as an X-value, then spends it on Venom and Drink.',
    pool: WIZARD_CARDS,
    theme: 'chamber',
    playable: true,
  },
  crab: {
    id: 'crab',
    name: 'The Crab',
    blurb: 'Churns its hand — cards with Molt play for free when discarded.',
    pool: CRAB_CARDS,
    theme: 'beach',
    playable: true,
  },
  writer: {
    id: 'writer',
    name: 'The Writer',
    blurb: 'Banks Craft, then burns it on cards that cost no energy at all.',
    pool: WRITER_CARDS,
    theme: 'study',
    playable: true,
  },
};

export interface RelicDef {
  readonly id: string;
  readonly name: string;
  readonly text: string;
  /** Extra max HP granted at combat start (applied when the combatant is built). */
  readonly bonusMaxHp?: number;
  /** Atomic actions applied to the owner once, at the start of combat. */
  readonly onCombatStart?: (ownerId: EntityId) => Action[];
  /**
   * Replaces how many cards the opening hand draws (Seashell: 6 instead of 5).
   * A *replacement*, not a bonus draw — the mulligan still discards the usual
   * number, so the relic's effect is the net card it leaves you holding.
   */
  readonly openingHand?: number;
}

/**
 * The relic pool offered to the player. The setup screen offers three; the
 * player keeps one for the battle.
 *
 * `name` doubles as the icon file name (`art/relic/Relics-<name>.png`), so the
 * names here must match the art exactly — which is why it's "Brain Jar" and
 * "Eye" rather than the older "Brain in a Jar" / "Rusty Knife".
 *
 * Only combat-start relics are modelled today. The design's ongoing relics
 * (Urn's end-of-turn shield, Toy Boat's Molt bonus, Fish Food, Whale, Hand,
 * Thorn, Leaky Potion, and the Writer/Old Lady sets) need relic *triggers* —
 * the same hooks persistents have — which is still to come (`docs/roadmap.md`).
 */
export const RELICS: readonly RelicDef[] = [
  // --- general ---------------------------------------------------------------
  { id: 'ripped-heart', name: 'Ripped Heart', text: 'Start combat with 3 additional Max HP.', bonusMaxHp: 3 },
  {
    id: 'sword',
    name: 'Sword',
    text: 'Begin combat by dealing 4 damage to a random opponent.',
    onCombatStart: (o) => [{ type: 'DealDamageToRandomEnemy', self: o, amount: 4 }],
  },
  {
    id: 'brain-jar',
    name: 'Brain Jar',
    text: 'When you run out of cards, draw 4 cards instead of 3.',
    onCombatStart: (o) => [{ type: 'IncreaseRefillDraw', target: o, amount: 1 }],
  },
  {
    id: 'old-shield',
    name: 'Old Shield',
    text: 'Start combat with 5 Shields.',
    onCombatStart: (o) => [{ type: 'GainShield', target: o, amount: 5 }],
  },
  {
    id: 'calculator',
    name: 'Calculator',
    text: 'Start combat with 2 Energy.',
    onCombatStart: (o) => [{ type: 'GainEnergy', target: o, amount: 2 }],
  },
  {
    // "You can keep all 5 cards drawn" — modelled as drawing 7 and still
    // discarding 2, which leaves the same 5-card opening hand.
    id: 'key',
    name: 'Key',
    text: 'Keep all 5 cards of your opening hand.',
    openingHand: OPENING_HAND + OPENING_DISCARD,
  },
  {
    id: 'eye',
    name: 'Eye',
    text: 'At the start of combat, deal 3 damage to all opponents.',
    onCombatStart: (o) => [{ type: 'DealDamageToAll', self: o, amount: 3 }],
  },
  // --- Cloud -----------------------------------------------------------------
  {
    id: 'lightning-rod',
    name: 'Lightning Rod',
    text: 'At the start of combat, create 1 Lightning Cloud.',
    onCombatStart: (o) => [{ type: 'CreateClouds', target: o, cloudType: 'lightning', count: 1 }],
  },
  {
    id: 'smokepipe',
    name: 'Smokepipe',
    text: 'At the start of combat, create 1 Fog Cloud.',
    onCombatStart: (o) => [{ type: 'CreateClouds', target: o, cloudType: 'fog', count: 1 }],
  },
  {
    id: 'raindrop',
    name: 'Raindrop',
    text: 'At the start of combat, create 1 Storm Cloud.',
    onCombatStart: (o) => [{ type: 'CreateClouds', target: o, cloudType: 'storm', count: 1 }],
  },
  {
    id: 'snow-globe',
    name: 'Snow Globe',
    text: 'At the start of combat, create 1 Snow Cloud.',
    onCombatStart: (o) => [{ type: 'CreateClouds', target: o, cloudType: 'snow', count: 1 }],
  },
  // --- Wizard ----------------------------------------------------------------
  {
    id: 'vial',
    name: 'Vial',
    text: 'Start combat with 3 Poison.',
    onCombatStart: (o) => [{ type: 'GainPoison', target: o, amount: 3 }],
  },
  // --- Crab ------------------------------------------------------------------
  {
    id: 'seashell',
    name: 'Seashell',
    text: 'Draw 6 cards for your opening hand instead of 5 (still discard 2).',
    openingHand: OPENING_HAND + 1,
  },
  {
    id: 'fossil',
    name: 'Fossil',
    text: 'At the start of combat, add Molt to a card in your hand.',
    onCombatStart: (o) => [{ type: 'AddKeywordToHand', owner: o, keyword: 'molt', count: 1 }],
  },
  // --- Writer ----------------------------------------------------------------
  {
    id: 'notebook',
    name: 'Notebook',
    text: 'Craft 3 at the start of combat.',
    onCombatStart: (o) => [{ type: 'GainCraft', target: o, amount: 3 }],
  },
  {
    id: 'pencil',
    name: 'Pencil',
    text: 'Start combat with 1 Bravery.',
    onCombatStart: (o) => [{ type: 'GainBravery', target: o, amount: 1 }],
  },
  // --- Old Lady --------------------------------------------------------------
  {
    id: 'earring',
    name: 'Earring',
    text: 'Start combat with 2 Power.',
    onCombatStart: (o) => [{ type: 'GainPower', target: o, amount: 2 }],
  },
];

/** Relic names with a drawn icon; the rest fall back to a glyph in the UI. */
export const RELIC_ART = new Set([
  'Brain Jar', 'Calculator', 'Chest', 'Compass', 'Eye', 'Fish Food', 'Fossil', 'Frog Leg',
  'Hand', 'Key', 'Leaky Potion', 'Lightning Rod', 'Magic Wand', 'Old Shield', 'Raindrop',
  'Ripped Heart', 'Seashell', 'Smokepipe', 'Snow Globe', 'Sword', 'Thorn', 'Toy Boat',
  'Urn', 'Vial', 'Whale',
]);

export function getRelic(id: string): RelicDef | undefined {
  return RELICS.find((r) => r.id === id);
}

/**
 * The opponent's deck. A curated, cloud-themed aggressive deck built from simple
 * attack/defense cards only — deliberately no cloud/poison/minion cards, so the
 * player's own reactive persistents stay correctly inert during the enemy's turn
 * (they key off "your" cloud/minion events, which the enemy never produces).
 */
export function enemyDeck(): CardId[] {
  const times = (card: CardDef, n: number): CardId[] => Array.from({ length: n }, () => card.id);
  return [
    ...times(CLOUD_ZAP, 3),
    ...times(SUN_RAY, 4),
    ...times(CRISSCROSS, 4),
    ...times(SHINE, 2),
    ...times(RAIN, 3),
    ...times(HAZE, 2),
    ...times(CLEANSE, 2),
  ];
}
