/**
 * The single-battle driver.
 *
 * This is the game loop the design describes: build a deck, draw 5 / discard 2,
 * take turns playing cards until one side hits 0 HP. It sits on top of the turn
 * orchestrator (`startTurn`/`endTurn`) and the engine reducer, and — crucially —
 * runs the ENEMY through the exact same machinery as the player: the opponent has
 * its own deck/hand and plays real cards via `playFromHand`.
 *
 * Everything stays pure and deterministic: same seed + same player moves ⇒ the
 * same battle, so a match is replayable and (eventually) netcode-ready.
 */
import {
  initialState,
  makeCombatant,
  nextInt,
  opponentsOf,
  shuffle,
  type Action,
  type Combatant,
  type GameEvent,
  type GameState,
  type RngState,
} from '@engine/index';
import { entityId, type CardId, type EntityId } from '@shared/index';
import { compile } from '@cards/compile';
import { getCard, type CardDef } from '@cards/registry';
import type { PlayContext } from '@cards/dsl/resolver';
import { runWithTriggers, runTurnCascade, startTurn, endTurn, type RunResult } from '@cards/match/index';
import { BASE_ENERGY, BASE_MAX_HP, DECK_SIZE, CHARACTERS, enemyDeck, getRelic } from '@cards/match/content';

export const OPENING_HAND = 5;
export const OPENING_DISCARD = 2;
/** Cap on the enemy AI's card plays per turn — a backstop against a loop. */
const ENEMY_PLAY_CAP = 40;

export const PLAYER_ID = entityId('player');
export const ENEMY_ID = entityId('enemy');

export interface BattleOptions {
  readonly character: 'cloud' | 'wizard';
  readonly relicId: string;
  readonly seed: string | number;
  /**
   * The opponent's character. Omit for the default curated "Rival Cloud". When
   * set (e.g. Attract Mode's Wizard vs Cloud), the enemy is built from that
   * character's real pool and plays it through the same AI.
   */
  readonly enemyCharacter?: 'cloud' | 'wizard';
}

/** Deterministically build a `size`-card deck from a character's pool. */
function buildDeck(pool: readonly CardDef[], size: number, rng: RngState): { deck: CardId[]; rng: RngState } {
  const ids = pool.map((c) => c.id);
  let bag = ids.slice();
  while (bag.length < size) bag = bag.concat(ids);
  const sh = shuffle(bag, rng);
  return { deck: sh.value.slice(0, size), rng: sh.state };
}

function combatantOf(state: GameState, id: EntityId): Combatant | undefined {
  return state.player.id === id ? state.player : state.enemies.find((e) => e.id === id);
}

/** If the battle is decided, the SetPhase action that ends it (else null). */
function outcomeAction(state: GameState): Action | null {
  if (state.phase === 'won' || state.phase === 'lost') return null;
  if (state.player.hp <= 0) return { type: 'SetPhase', phase: 'lost' };
  if (state.enemies.length > 0 && state.enemies.every((e) => e.hp <= 0)) return { type: 'SetPhase', phase: 'won' };
  return null;
}

/**
 * Set up a fresh battle: both sides get a shuffled deck and an opening hand of 5,
 * relic combat-start effects fire, and we pause in the `mulligan` phase for the
 * player to discard 2 (see `confirmMulligan`).
 */
export function newBattle(opts: BattleOptions): GameState {
  const base = initialState({ seed: opts.seed, deck: [] });
  const char = CHARACTERS[opts.character];
  const relic = getRelic(opts.relicId);
  let rng = base.rng;

  const pDeck = buildDeck(char.pool, DECK_SIZE, rng);
  rng = pDeck.rng;

  // The opponent: either the curated "Rival Cloud", or a real character (its full
  // pool) when `enemyCharacter` is set — that's what makes Attract Mode's Wizard
  // vs Cloud a genuine mirror match, both sides playing their own cards.
  const eChar = opts.enemyCharacter ? CHARACTERS[opts.enemyCharacter] : null;
  const eBuilt = eChar ? buildDeck(eChar.pool, DECK_SIZE, rng) : { deck: enemyDeck(), rng };
  const eDeck = eChar ? { value: eBuilt.deck, state: eBuilt.rng } : shuffle(eBuilt.deck, rng);
  rng = eDeck.state;

  const bonusHp = relic?.bonusMaxHp ?? 0;
  const player = makeCombatant({
    id: PLAYER_ID,
    name: char.name,
    character: char.id,
    hp: BASE_MAX_HP + bonusHp,
    maxHp: BASE_MAX_HP + bonusHp,
    energy: BASE_ENERGY,
    drawPile: pDeck.deck,
  });
  const enemy = makeCombatant({
    id: ENEMY_ID,
    name: eChar ? eChar.name : 'Rival Cloud',
    character: eChar ? eChar.id : 'cloud',
    hp: BASE_MAX_HP,
    maxHp: BASE_MAX_HP,
    energy: BASE_ENERGY,
    drawPile: eDeck.value,
  });

  let state: GameState = { ...base, rng, phase: 'setup', turn: 0, player, enemies: [enemy] };

  if (relic?.onCombatStart) state = runWithTriggers(state, relic.onCombatStart(player.id)).state;

  state = runWithTriggers(state, [{ type: 'DrawCards', owner: player.id, count: OPENING_HAND }]).state;
  state = runWithTriggers(state, [{ type: 'DrawCards', owner: enemy.id, count: OPENING_HAND }]).state;
  return { ...state, phase: 'mulligan' };
}

/**
 * Finish the opening: discard the chosen cards, then begin turn 1. No extra draw
 * (the opening hand IS turn 1's hand) and no energy reset (so a combat-start
 * energy relic like Calculator survives into the first turn).
 */
export function confirmMulligan(state: GameState, discardIndices: readonly number[]): RunResult {
  let cur = state;
  const events: GameEvent[] = [];
  // Remove highest indices first so earlier removals don't shift later ones.
  for (const idx of [...discardIndices].sort((a, b) => b - a)) {
    const r = runWithTriggers(cur, [{ type: 'MoveHandCardToDiscard', owner: cur.player.id, index: idx }]);
    cur = r.state;
    events.push(...r.events);
  }
  const begun = startTurn(cur, { draw: 0 });
  return { state: begun.state, events: [...events, ...begun.events] };
}

/**
 * Play the card at `handIndex` from `actorId`'s hand: validate energy, spend it,
 * move the card to the discard, resolve its effects (with triggers), then settle
 * win/lose. Returns the state unchanged if the move is illegal (wrong phase, no
 * such card, not enough energy).
 */
export function playFromHand(
  state: GameState,
  actorId: EntityId,
  handIndex: number,
  targetId?: EntityId,
): RunResult {
  if (state.phase === 'won' || state.phase === 'lost') return { state, events: [] };
  const actor = combatantOf(state, actorId);
  const cardId = actor?.hand[handIndex];
  const card = cardId ? getCard(cardId) : undefined;
  if (!actor || !cardId || !card || actor.energy < card.cost) return { state, events: [] };

  const target = targetId ?? opponentsOf(state, actorId)[0]?.id ?? actorId;
  let cur = state;
  const events: GameEvent[] = [];
  const run = (actions: readonly Action[]) => {
    const r = runWithTriggers(cur, actions);
    cur = r.state;
    events.push(...r.events);
  };

  run([{ type: 'SetEnergy', target: actorId, amount: actor.energy - card.cost }]);
  run([{ type: 'MoveHandCardToDiscard', owner: actorId, index: handIndex }]);
  const compiled = compile(card.text);
  if (compiled.ok) {
    const ctx: PlayContext = { self: actorId, target, sourceCard: cardId };
    run(compiled.value.map((produce) => produce(ctx)));
  }
  const outcome = outcomeAction(cur);
  if (outcome) run([outcome]);
  return { state: cur, events };
}

const finished = (s: GameState): boolean => s.phase === 'won' || s.phase === 'lost';

/** Settle win/lose after a step: append the SetPhase outcome action if one is due. */
function settleAfter(r: RunResult): RunResult {
  const o = outcomeAction(r.state);
  if (!o) return r;
  const s = runWithTriggers(r.state, [o]);
  return { state: s.state, events: [...r.events, ...s.events] };
}

/** Hand indices a combatant may legally play right now (in hand + affordable). */
function validPlays(actor: Combatant): number[] {
  const idxs: number[] = [];
  for (let i = 0; i < actor.hand.length; i++) {
    const card = getCard(actor.hand[i]!);
    if (card && actor.energy >= card.cost) idxs.push(i);
  }
  return idxs;
}

/** Result of one AI play — carries the card so the UI can name it. */
export interface EnemyPlay {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly cardId: CardId;
}

/**
 * Play ONE card for `actorId`, the AI way: gather every legal play, pick one
 * uniformly at random via the in-state RNG, and play it at a random opponent.
 * Returns null when the actor has no legal play left. The random choice threads
 * `state.rng`, so a battle stays deterministic (same seed ⇒ same plays). This is
 * the whole AI — used for the enemy in single-player and for BOTH sides in
 * Attract Mode.
 */
export function aiPlayOne(state: GameState, actorId: EntityId): EnemyPlay | null {
  if (finished(state)) return null;
  const actor = combatantOf(state, actorId);
  if (!actor || actor.hp <= 0) return null;

  const valid = validPlays(actor);
  if (valid.length === 0) return null;

  const draw = nextInt(state.rng, 0, valid.length - 1);
  const index = valid[draw.value]!;
  const cardId = actor.hand[index]!;
  // playFromHand defaults the target to the actor's first opponent.
  const played = settleAfter(playFromHand({ ...state, rng: draw.state }, actorId, index));
  return { state: played.state, events: played.events, cardId };
}

// ---- The enemy turn, decomposed so the UI can pace it -----------------------
// `endPlayerTurn` composes these synchronously (tests / headless); the game view
// calls them one at a time with timers between (3s before the turn, 1s per card).

/** The player's own end-of-turn (persistents, fog discard); leaves `enemyTurn`. */
export function endPlayerPhase(state: GameState): RunResult {
  if (finished(state)) return { state, events: [] };
  return settleAfter(endTurn(state));
}

/**
 * Begin the enemy's turn: switch phase, then run the shared start-of-turn cascade
 * (clear block, reset energy, fire the enemy's own clouds/minions, draw 1).
 */
export function beginEnemyTurn(state: GameState): RunResult {
  const enemyId = state.enemies[0]?.id ?? state.player.id;
  const phased = runWithTriggers(state, [{ type: 'SetPhase', phase: 'enemyTurn' }]);
  const cascade = runTurnCascade(phased.state, enemyId, { resetEnergyTo: BASE_ENERGY, draw: 1 });
  return settleAfter({ state: cascade.state, events: [...phased.events, ...cascade.events] });
}

/** One enemy card during its turn (a thin wrapper over the shared `aiPlayOne`). */
export function enemyPlayOne(state: GameState): EnemyPlay | null {
  if (state.phase !== 'enemyTurn') return null;
  const enemyId = state.enemies[0]?.id;
  return enemyId ? aiPlayOne(state, enemyId) : null;
}

/** Begin the player's next turn: reset energy to base, draw 1. */
export function beginPlayerTurn(state: GameState): RunResult {
  if (finished(state)) return { state, events: [] };
  return settleAfter(startTurn(state, { resetEnergyTo: BASE_ENERGY, draw: 1 }));
}

/**
 * The whole round, synchronously: player end-of-turn → the enemy's full turn
 * (random plays until none remain) → the player's next turn. The animated game
 * view drives the same steps with timers instead; this is the source of truth
 * they share, and what tests/headless play use.
 */
export function endPlayerTurn(state: GameState): RunResult {
  if (finished(state)) return { state, events: [] };
  const events: GameEvent[] = [];

  const ended = endPlayerPhase(state);
  events.push(...ended.events);
  if (finished(ended.state)) return { state: ended.state, events };

  const begun = beginEnemyTurn(ended.state);
  events.push(...begun.events);
  let cur = begun.state;
  if (finished(cur)) return { state: cur, events };

  for (let guard = 0; guard < ENEMY_PLAY_CAP; guard++) {
    const play = enemyPlayOne(cur);
    if (!play) break;
    cur = play.state;
    events.push(...play.events);
    if (finished(cur)) return { state: cur, events };
  }

  const next = beginPlayerTurn(cur);
  return { state: next.state, events: [...events, ...next.events] };
}
