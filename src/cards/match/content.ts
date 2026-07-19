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

/** Base energy every combatant starts each turn with (design: "start with 1"). */
export const BASE_ENERGY = 1;
/** Starting/most HP a combatant has (design: "start with 20 Health"). */
export const BASE_MAX_HP = 20;
/** Cards in a starting deck (design: "a deck of 20 random cards"). */
export const DECK_SIZE = 20;
/** Most clouds a combatant may hold; creating more replaces existing ones. */
export const CLOUD_CAP = 3;

export interface CharacterDef {
  readonly id: CharacterId;
  readonly name: string;
  readonly blurb: string;
  /** The ~40-card pool a 20-card deck is drawn from (authored subset today). */
  readonly pool: readonly CardDef[];
  /** Background theme key the battle screen uses. */
  readonly theme: 'field' | 'chamber' | 'beach';
  /** False until the character has authored cards + art. */
  readonly playable: boolean;
}

/** The two characters with authored cards. Others are placeholders for later. */
export const CHARACTERS: Record<'cloud' | 'wizard', CharacterDef> = {
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
};

export interface RelicDef {
  readonly id: string;
  readonly name: string;
  readonly text: string;
  /** Extra max HP granted at combat start (applied when the combatant is built). */
  readonly bonusMaxHp?: number;
  /** Atomic actions applied to the owner once, at the start of combat. */
  readonly onCombatStart?: (ownerId: EntityId) => Action[];
}

/**
 * The relic pool offered to the player (general + a couple character relics). The
 * setup screen offers three of these; the player keeps one for the battle.
 */
export const RELICS: readonly RelicDef[] = [
  { id: 'ripped-heart', name: 'Ripped Heart', text: 'Start combat with 3 additional Max HP.', bonusMaxHp: 3 },
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
    id: 'sword',
    name: 'Sword',
    text: 'Begin combat by dealing 4 damage to a random opponent.',
    onCombatStart: (o) => [{ type: 'DealDamageToRandomEnemy', self: o, amount: 4 }],
  },
  {
    id: 'lightning-rod',
    name: 'Lightning Rod',
    text: 'Start combat with 1 Lightning Cloud.',
    onCombatStart: (o) => [{ type: 'CreateClouds', target: o, cloudType: 'lightning', count: 1 }],
  },
  {
    id: 'vial',
    name: 'Vial',
    text: 'Start combat with 3 Poison.',
    onCombatStart: (o) => [{ type: 'GainPoison', target: o, amount: 3 }],
  },
];

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
