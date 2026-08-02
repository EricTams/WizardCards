/**
 * cards — public API surface.
 *
 * Exposes the DSL pipeline, card definitions, and the registry. Imports from
 * `engine` and `shared` only (never `ui`).
 */
import { ok, err } from '@shared/index';
import type { Result, Diagnostic } from '@shared/index';

export type { Token, TokenType } from '@cards/dsl/tokenizer';
export { tokenize } from '@cards/dsl/tokenizer';
export type { CardScript, EffectNode, Verb } from '@cards/dsl/ast';
export { parse } from '@cards/dsl/parser';
export { resolve, type ActionProducer, type PlayContext } from '@cards/dsl/resolver';
export { compile } from '@cards/compile';

export type { CardDef } from '@cards/registry';
export { ALL_CARDS, PERSISTENT_CARDS, getCard } from '@cards/registry';

export type { CardOverrides } from '@cards/overrides';
export { EMPTY_OVERRIDES, applyOverrides, hasNoOverrides } from '@cards/overrides';

export type { CardField, ModifiedCard, CardDiff, CardDiffReport } from '@cards/diff';
export { diffCards, isEmptyDiff, buildReport } from '@cards/diff';

export type {
  CardTest,
  CardTestSetup,
  CardTestExpect,
  CombatantExpect,
  CardTestFailure,
  CardTestResult,
} from '@cards/testing';
export { runCardTest, buildTestState, pileOf, snapshotExpect, TEST_SELF, TEST_TARGET } from '@cards/testing';
export { CARD_TESTS, testsForCard } from '@cards/card-tests';

export type { RunResult } from '@cards/match/index';
export {
  playCard,
  startTurn,
  endTurn,
  cloudEffects,
  reactiveTriggers,
  applyWithTriggers,
  runWithTriggers,
} from '@cards/match/index';
export type { PersistentBehavior } from '@cards/match/compile-persistent';
export { compilePersistent } from '@cards/match/compile-persistent';
export { activePersistents, persistentBehavior } from '@cards/match/persistents';

export type { BattleOptions, EnemyPlay, PlayableCharacter } from '@cards/match/battle';
export {
  newBattle,
  confirmMulligan,
  playFromHand,
  canPlayAt,
  resolvePendingChoice,
  endPlayerTurn,
  endPlayerPhase,
  beginEnemyTurn,
  enemyPlayOne,
  aiPlayOne,
  beginPlayerTurn,
  OPENING_HAND,
  OPENING_DISCARD,
  PLAYER_ID,
  ENEMY_ID,
  randomMatchup,
  capClouds,
} from '@cards/match/battle';
export type { CharacterDef, RelicDef } from '@cards/match/content';
export { CHARACTERS, RELICS, getRelic, BASE_MAX_HP, BASE_ENERGY, DECK_SIZE, CLOUD_CAP, cloudCapFor } from '@cards/match/content';

export { ok, err };
export type { Result, Diagnostic };
