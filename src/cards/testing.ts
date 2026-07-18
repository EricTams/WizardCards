/**
 * Declarative card tests — a serializable spec + a pure runner.
 *
 * A CardTest describes, as plain data: a starting situation (setup), which card
 * to play, and the expected result (expect). Because it's just JSON, the SAME
 * spec is used two ways:
 *   - the Vitest suite runs the built-in specs (see `card-tests.ts`), and
 *   - the Card Lab lets an author build one in the UI, run it, and export it
 *     alongside the card diff report.
 *
 * The runner is pure (no I/O, no DOM): build a sandbox GameState, play the card
 * through the real engine reducer, then diff actual-vs-expected. Only the fields
 * you specify in `expect` are checked, so a test can assert just "target hp is 24"
 * and ignore everything else.
 */
import { type CardId, type EntityId, entityId } from '@shared/index';
import {
  initialState,
  makeCombatant,
  applyAll,
  type Combatant,
  type GameState,
} from '@engine/index';
import type { CardDef } from '@cards/registry';
import { compile } from '@cards/compile';

/** The player and the primary target used by every card test. */
export const TEST_SELF: EntityId = entityId('player');
export const TEST_TARGET: EntityId = entityId('target-0');

/** Numeric resources plus cloud/minion *counts* you can assert after a play. */
export interface CombatantExpect {
  readonly hp?: number;
  readonly maxHp?: number;
  readonly block?: number;
  readonly shield?: number;
  readonly energy?: number;
  readonly poison?: number;
  readonly power?: number;
  readonly bravery?: number;
  /** Expected number of clouds (of any type) in play. */
  readonly clouds?: number;
  /** Expected number of minions in play. */
  readonly minions?: number;
}

export interface CardTestSetup {
  readonly seed?: string;
  /** Overrides on the player combatant (hp/resources/clouds/minions). */
  readonly player?: Partial<Combatant>;
  /** Overrides on the primary target combatant. */
  readonly target?: Partial<Combatant>;
  readonly hand?: readonly CardId[];
  readonly drawPile?: readonly CardId[];
  readonly discardPile?: readonly CardId[];
}

export interface CardTestExpect {
  readonly player?: CombatantExpect;
  readonly target?: CombatantExpect;
  readonly handSize?: number;
  readonly drawPileSize?: number;
  readonly discardPileSize?: number;
}

export interface CardTest {
  readonly name: string;
  readonly cardId: CardId;
  readonly setup: CardTestSetup;
  readonly expect: CardTestExpect;
}

export interface CardTestFailure {
  readonly field: string;
  readonly expected: number;
  readonly actual: number;
}

export interface CardTestResult {
  readonly ok: boolean;
  readonly failures: readonly CardTestFailure[];
  /** Set when the card couldn't even be compiled/played (a harder failure). */
  readonly error?: string;
}

/** Build the sandbox GameState a card test plays inside. */
export function buildTestState(setup: CardTestSetup = {}): GameState {
  const base = initialState({ seed: setup.seed ?? 'card-test', deck: [] });
  const player = makeCombatant({
    name: 'Player',
    hp: 50,
    maxHp: 50,
    ...setup.player,
    id: TEST_SELF,
  });
  const target = makeCombatant({
    name: 'Target',
    hp: 50,
    maxHp: 50,
    ...setup.target,
    id: TEST_TARGET,
  });
  return {
    ...base,
    phase: 'playerTurn',
    player,
    enemies: [target],
    drawPile: setup.drawPile?.slice() ?? [],
    hand: setup.hand?.slice() ?? [],
    discardPile: setup.discardPile?.slice() ?? [],
  };
}

/** Compile + play `card` under `test`, returning a structured pass/fail result. */
export function runCardTest(card: CardDef, test: CardTest): CardTestResult {
  const compiled = compile(card.text);
  if (!compiled.ok) {
    return { ok: false, failures: [], error: `"${card.text}" does not compile` };
  }

  let state = buildTestState(test.setup);
  try {
    const ctx = { self: TEST_SELF, target: TEST_TARGET, sourceCard: card.id };
    const actions = compiled.value.map((produce) => produce(ctx));
    state = applyAll(state, actions).state;
  } catch (e) {
    return { ok: false, failures: [], error: e instanceof Error ? e.message : String(e) };
  }

  const failures: CardTestFailure[] = [];
  if (test.expect.player) compareCombatant('player', test.expect.player, state.player, failures);
  if (test.expect.target) compareCombatant('target', test.expect.target, state.enemies[0]!, failures);
  compareSize('hand', test.expect.handSize, state.hand.length, failures);
  compareSize('drawPile', test.expect.drawPileSize, state.drawPile.length, failures);
  compareSize('discardPile', test.expect.discardPileSize, state.discardPile.length, failures);

  return { ok: failures.length === 0, failures };
}

/**
 * Play `card` once against `setup` and snapshot the resulting state as a full
 * CardTestExpect. This is the Card Lab's "capture a test from the current
 * situation" flow: set up the arena, play the card, and record what it did as
 * the expectation the test will then guard.
 */
export function snapshotExpect(
  card: CardDef,
  setup: CardTestSetup,
): { readonly ok: true; readonly expect: CardTestExpect } | { readonly ok: false; readonly error: string } {
  const compiled = compile(card.text);
  if (!compiled.ok) return { ok: false, error: `"${card.text}" does not compile` };

  let state = buildTestState(setup);
  try {
    const ctx = { self: TEST_SELF, target: TEST_TARGET, sourceCard: card.id };
    state = applyAll(state, compiled.value.map((produce) => produce(ctx))).state;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const snap = (c: Combatant): CombatantExpect => ({
    hp: c.hp,
    maxHp: c.maxHp,
    block: c.block,
    shield: c.shield,
    energy: c.energy,
    poison: c.poison,
    power: c.power,
    bravery: c.bravery,
    clouds: c.clouds.length,
    minions: c.minions.length,
  });

  return {
    ok: true,
    expect: {
      player: snap(state.player),
      target: snap(state.enemies[0]!),
      handSize: state.hand.length,
      drawPileSize: state.drawPile.length,
      discardPileSize: state.discardPile.length,
    },
  };
}

function compareCombatant(
  who: string,
  expected: CombatantExpect,
  actual: Combatant,
  failures: CardTestFailure[],
): void {
  const push = (field: string, exp: number | undefined, act: number) => {
    if (exp !== undefined && exp !== act) failures.push({ field: `${who}.${field}`, expected: exp, actual: act });
  };
  push('hp', expected.hp, actual.hp);
  push('maxHp', expected.maxHp, actual.maxHp);
  push('block', expected.block, actual.block);
  push('shield', expected.shield, actual.shield);
  push('energy', expected.energy, actual.energy);
  push('poison', expected.poison, actual.poison);
  push('power', expected.power, actual.power);
  push('bravery', expected.bravery, actual.bravery);
  push('clouds', expected.clouds, actual.clouds.length);
  push('minions', expected.minions, actual.minions.length);
}

function compareSize(
  field: string,
  expected: number | undefined,
  actual: number,
  failures: CardTestFailure[],
): void {
  if (expected !== undefined && expected !== actual) {
    failures.push({ field: `${field}.size`, expected, actual });
  }
}
