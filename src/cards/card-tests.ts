/**
 * Built-in card tests.
 *
 * One or more declarative CardTests per card, exercising the interesting cases
 * (resource math, cloud create/remove, the Poison keyword ordering, minions).
 * The Vitest suite (`tests/cards/card-tests.test.ts`) runs every entry; the Card
 * Lab will let authors add more of these in the UI and export them.
 *
 * Keep specs terse: `expect` only asserts the fields a card actually changes.
 */
import { entityId, type CardId } from '@shared/index';
import type { MinionState } from '@engine/index';
import type { CardTest } from '@cards/testing';
import {
  SUN_RAY,
  SHINE,
  HURRICANE,
  CLEANSE,
  SPRINKLE,
  RAIN,
  HAZE,
  CLOUD_ZAP,
  ELECTROCUTE,
  SPIN,
} from '@cards/definitions/cloud';
import {
  STUN,
  BARREL_ROLL,
  CURSE,
  HOSTILE,
  FUEL,
  POUR,
  THROW,
  POISON_SPILL,
  ALCHEMY,
  CRYSTAL_BALL,
  HURL,
} from '@cards/definitions/wizard';
import { PEN_STAB, QUILL, PODCAST, BRAIN_STORM, TROPHY, TYPE, NOTES } from '@cards/definitions/writer';

/** A stand-in minion for setups that need one already in play. */
const dummyMinion = (cardId: CardId): MinionState => ({ id: entityId('minion-seed'), cardId });

export const CARD_TESTS: readonly CardTest[] = [
  // --- Cloud ---------------------------------------------------------------
  {
    name: 'Zap deals 2 and gains 1 energy',
    cardId: CLOUD_ZAP.id,
    setup: { target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 28 }, player: { energy: 1 } },
  },
  {
    name: 'Sun Ray deals 3 and removes a cloud',
    cardId: SUN_RAY.id,
    setup: { player: { clouds: ['storm'] }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 27 }, player: { clouds: 0 } },
  },
  {
    name: 'Shine removes 3 clouds (only as many as exist)',
    cardId: SHINE.id,
    setup: { player: { clouds: ['storm', 'fog'] }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 24 }, player: { clouds: 0 } },
  },
  {
    name: 'Hurricane deals 3 and creates 2 storm clouds',
    cardId: HURRICANE.id,
    setup: { target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 27 }, player: { clouds: 2 } },
  },
  {
    name: 'Cleanse heals 3 (capped at maxHp) and removes 2 clouds',
    cardId: CLEANSE.id,
    setup: { player: { hp: 20, maxHp: 30, clouds: ['snow', 'snow', 'fog'] } },
    expect: { player: { hp: 23, clouds: 1 } },
  },
  {
    name: 'Sprinkle gains 2 shields and creates a fog cloud',
    cardId: SPRINKLE.id,
    setup: {},
    expect: { player: { shield: 2, clouds: 1 } },
  },
  {
    name: 'Rain gains 4 shields',
    cardId: RAIN.id,
    setup: {},
    expect: { player: { shield: 4 } },
  },
  {
    name: 'Haze draws 3 cards',
    cardId: HAZE.id,
    setup: { drawPile: ['a', 'b', 'c', 'd'] as CardId[] },
    expect: { handSize: 3, drawPileSize: 1 },
  },

  // --- Wizard --------------------------------------------------------------
  {
    name: 'Stun deals 3',
    cardId: STUN.id,
    setup: { target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 27 } },
  },
  {
    name: 'Barrel Roll deals 5 and adds 2 poison',
    cardId: BARREL_ROLL.id,
    setup: { target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 25 }, player: { poison: 2 } },
  },
  {
    name: 'Curse stores 5 poison',
    cardId: CURSE.id,
    setup: {},
    expect: { player: { poison: 5 } },
  },
  {
    name: 'Hostile: Venom spends poison as damage, then Drink finds none left',
    cardId: HOSTILE.id,
    setup: { player: { poison: 4 }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 26 }, player: { poison: 0, block: 0 } },
  },
  {
    name: 'Fuel adds 3 poison then Drink converts it to 3 block',
    cardId: FUEL.id,
    setup: { player: { poison: 0 } },
    expect: { player: { poison: 0, block: 3 } },
  },
  {
    name: 'Pour spends 6 poison as damage and gains 3 shields',
    cardId: POUR.id,
    setup: { player: { poison: 6 }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 24 }, player: { poison: 0, shield: 3 } },
  },
  {
    name: 'Damage soaks block first, then shield, then hp',
    cardId: SHINE.id, // Deal 6 damage
    setup: { target: { hp: 30, maxHp: 30, block: 2, shield: 1 } },
    expect: { target: { hp: 27, block: 0, shield: 0 } },
  },

  // --- scaling -------------------------------------------------------------
  {
    name: 'Electrocute deals damage equal to your energy',
    cardId: ELECTROCUTE.id,
    setup: { player: { energy: 3 }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 27 } },
  },
  {
    name: 'Spin deals 3 per unique cloud type (not per cloud)',
    cardId: SPIN.id,
    setup: { player: { clouds: ['storm', 'storm', 'fog'] }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 24 } }, // 3 × 2 unique = 6
  },
  {
    name: 'Crystal Ball deals 1 per minion in play',
    cardId: CRYSTAL_BALL.id,
    setup: { player: { minions: [dummyMinion(ALCHEMY.id), dummyMinion(ALCHEMY.id)] }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 28 } }, // 1 × 2 minions
  },
  {
    name: 'Hurl discards 2 minions then deals damage equal to your defense (block + shield)',
    cardId: HURL.id,
    setup: {
      player: { block: 5, shield: 2, minions: [dummyMinion(ALCHEMY.id), dummyMinion(ALCHEMY.id)] },
      target: { hp: 30, maxHp: 30 },
    },
    expect: { target: { hp: 23 }, player: { minions: 0 } }, // 5 block + 2 shield = 7 damage
  },
  {
    name: 'Throw deals 8 and discards a minion',
    cardId: THROW.id,
    setup: { player: { minions: [dummyMinion(THROW.id)] }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 22 }, player: { minions: 0 } },
  },
  {
    name: 'Poison Spill summons a minion and spends poison as Venom',
    cardId: POISON_SPILL.id,
    setup: { player: { poison: 3 }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 27 }, player: { minions: 1, poison: 0 } },
  },
  {
    name: 'Alchemy summons a minion and adds 1 poison',
    cardId: ALCHEMY.id,
    setup: {},
    expect: { player: { minions: 1, poison: 1 } },
  },

  // --- Writer ----------------------------------------------------------------
  {
    name: 'Pen Stab deals 3 and gains 1 energy',
    cardId: PEN_STAB.id,
    setup: { target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 27 }, player: { energy: 1 } },
  },
  {
    name: 'Quill gains 4 shields then 1 bravery (no boost at 0 bravery)',
    cardId: QUILL.id,
    setup: {},
    expect: { player: { shield: 4, bravery: 1 } },
  },
  {
    name: "Quill's shields are boosted by Bravery already held",
    cardId: QUILL.id,
    setup: { player: { bravery: 2 } },
    expect: { player: { shield: 6, bravery: 3 } }, // 4 + 2 bravery
  },
  {
    name: 'Podcast banks bravery first, so its own shield is boosted',
    cardId: PODCAST.id,
    setup: {},
    expect: { player: { bravery: 2, shield: 3 } }, // 1 + the 2 bravery just gained
  },
  {
    name: 'Brain Storm converts bravery to damage and zeroes it',
    cardId: BRAIN_STORM.id,
    setup: { player: { bravery: 5 }, target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 25 }, player: { bravery: 0 } },
  },
  {
    name: 'Trophy burns 2 unplayable cards from hand and heals 3',
    cardId: TROPHY.id,
    setup: { player: { hp: 40, maxHp: 50, hand: [NOTES.id, NOTES.id] } },
    expect: { player: { hp: 43 }, handSize: 0, discardPileSize: 2 },
  },
  {
    name: 'Type finds 2 — the rider fires when an Unplayable card comes up',
    cardId: TYPE.id,
    setup: { drawPile: [NOTES.id, 'x'] as CardId[], target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 28 }, handSize: 2, drawPileSize: 0 },
  },
  {
    name: "Type's rider stays quiet when nothing Unplayable is found",
    cardId: TYPE.id,
    setup: { drawPile: ['x', 'y'] as CardId[], target: { hp: 30, maxHp: 30 } },
    expect: { target: { hp: 30 }, handSize: 2 },
  },
];

/** All tests targeting a given card id (used by the Card Lab and the suite). */
export function testsForCard(cardId: CardId): readonly CardTest[] {
  return CARD_TESTS.filter((t) => t.cardId === cardId);
}
