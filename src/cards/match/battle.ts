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
  seedRng,
  shuffle,
  type Action,
  type Combatant,
  type GameEvent,
  type GameState,
  instancesOf,
  type RngState,
} from '@engine/index';
import { entityId, type CardId, type EntityId } from '@shared/index';
import { compile } from '@cards/compile';
import { getCard, type CardDef } from '@cards/registry';
import type { PlayContext } from '@cards/dsl/resolver';
import { runWithTriggers, runTurnCascade, runOrPause, startTurn, endTurn, settleHandRefills, type RunResult } from '@cards/match/index';
import { BASE_ENERGY, BASE_MAX_HP, DECK_SIZE, cloudCapFor, CHARACTERS, enemyDeck, getRelic } from '@cards/match/content';
import { burnCostOf, stampPrintedKeywords } from '@cards/match/burn';

export const OPENING_HAND = 5;
export const OPENING_DISCARD = 2;
/** Cap on the enemy AI's card plays per turn — a backstop against a loop. */
const ENEMY_PLAY_CAP = 40;

export const PLAYER_ID = entityId('player');
export const ENEMY_ID = entityId('enemy');

/** The characters with an authored pool — the keys of CHARACTERS. */
export type PlayableCharacter = keyof typeof CHARACTERS;

export interface BattleOptions {
  readonly character: PlayableCharacter;
  readonly relicId: string;
  readonly seed: string | number;
  /**
   * The opponent's character. Omit for the default curated "Rival Cloud". When
   * set (as Attract Mode does for both sides), the enemy is built from that
   * character's real pool and plays it through the same AI.
   */
  readonly enemyCharacter?: PlayableCharacter;
}

/**
 * Pick two *different* playable characters to face each other — what Attract
 * Mode shows off.
 *
 * Derived from the seed rather than `Math.random`, so a given seed always yields
 * the same matchup: an odd-looking demo match can be reproduced from its seed
 * alone. The seed is namespaced so this draw doesn't correlate with the deck
 * shuffles the battle makes from the same seed.
 */
export function randomMatchup(seed: string | number): {
  character: PlayableCharacter;
  enemyCharacter: PlayableCharacter;
} {
  const ids = (Object.keys(CHARACTERS) as PlayableCharacter[]).filter((id) => CHARACTERS[id].playable);
  const first = nextInt(seedRng(`matchup-${seed}`), 0, ids.length - 1);
  const others = ids.filter((_, i) => i !== first.value);
  const second = nextInt(first.state, 0, others.length - 1);
  return { character: ids[first.value]!, enemyCharacter: others[second.value]! };
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

/** Discard `count` cards chosen at random from `owner`'s hand (deterministic via RNG). */
function discardRandom(state: GameState, owner: EntityId, count: number): GameState {
  let s = state;
  for (let i = 0; i < count; i++) {
    const c = combatantOf(s, owner);
    if (!c || c.hand.length === 0) break;
    const draw = nextInt(s.rng, 0, c.hand.length - 1);
    s = runWithTriggers({ ...s, rng: draw.state }, [
      { type: 'MoveHandCardToDiscard', owner, index: draw.value, reason: 'setup' },
    ]).state;
  }
  return s;
}

/**
 * Set up a fresh battle: both sides get a shuffled deck and an opening hand of 5,
 * relic combat-start effects fire. The enemy immediately mulligans (discards 2 at
 * random, as its AI has no choice to make); we pause in the `mulligan` phase for
 * the player to discard 2 (see `confirmMulligan`). Both sides open on 3 cards.
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

  // Wrap both decks as card *instances*, numbering them from a shared counter so
  // every copy in the battle has a unique, deterministic uid. Printed keywords
  // the engine must see (Unplayable) are stamped onto the copies here.
  const pInst = instancesOf(pDeck.deck, 0);
  const eInst = instancesOf(eDeck.value, pInst.idSeq);
  const pCards = stampPrintedKeywords(pInst.cards);
  const eCards = stampPrintedKeywords(eInst.cards);

  const bonusHp = relic?.bonusMaxHp ?? 0;
  const player = makeCombatant({
    id: PLAYER_ID,
    name: char.name,
    character: char.id,
    hp: BASE_MAX_HP + bonusHp,
    maxHp: BASE_MAX_HP + bonusHp,
    energy: BASE_ENERGY,
    drawPile: pCards,
  });
  const enemy = makeCombatant({
    id: ENEMY_ID,
    name: eChar ? eChar.name : 'Rival Cloud',
    character: eChar ? eChar.id : 'cloud',
    hp: BASE_MAX_HP,
    maxHp: BASE_MAX_HP,
    energy: BASE_ENERGY,
    drawPile: eCards,
  });

  let state: GameState = { ...base, rng, idSeq: eInst.idSeq, phase: 'setup', turn: 0, player, enemies: [enemy] };

  if (relic?.onCombatStart) state = runWithTriggers(state, relic.onCombatStart(player.id)).state;

  // A relic may replace the opening draw (Seashell: 6 instead of 5). The mulligan
  // still discards OPENING_DISCARD, so the relic's value is the extra card kept.
  const playerOpening = relic?.openingHand ?? OPENING_HAND;
  state = runWithTriggers(state, [{ type: 'DrawCards', owner: player.id, count: playerOpening }]).state;
  state = runWithTriggers(state, [{ type: 'DrawCards', owner: enemy.id, count: OPENING_HAND }]).state;
  state = discardRandom(state, enemy.id, OPENING_DISCARD); // the enemy's mulligan
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
    const r = runWithTriggers(cur, [
      { type: 'MoveHandCardToDiscard', owner: cur.player.id, index: idx, reason: 'setup' },
    ]);
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
  opts: { interactive?: boolean } = {},
): RunResult {
  if (state.phase === 'won' || state.phase === 'lost' || state.pending) return { state, events: [] };
  const actor = combatantOf(state, actorId);
  const instance = actor?.hand[handIndex];
  const cardId = instance?.cardId;
  const card = cardId ? getCard(cardId) : undefined;
  if (!actor || !cardId || !card || !canPlayAt(actor, handIndex)) return { state, events: [] };

  const target = targetId ?? opponentsOf(state, actorId)[0]?.id ?? actorId;
  let cur = state;
  const events: GameEvent[] = [];
  const run = (actions: readonly Action[]) => {
    const r = runWithTriggers(cur, actions);
    cur = r.state;
    events.push(...r.events);
  };

  run([{ type: 'SetEnergy', target: actorId, amount: actor.energy - card.cost }]);
  // Counted before the card's own effects, so a card that scales off "cards
  // played this turn" (Vial) includes itself — it is, after all, being played.
  run([{ type: 'NoteCardPlayed', owner: actorId }]);
  run([{ type: 'MoveHandCardToDiscard', owner: actorId, index: handIndex }]);
  const compiled = compile(card.text);
  if (compiled.ok) {
    const ctx: PlayContext = { self: actorId, target, sourceCard: cardId };
    // Interactively, a discard/burn with a real choice PAUSES here — the rest
    // of the card waits in `pending.queued` for `resolvePendingChoice`.
    const ran = runOrPause(cur, compiled.value.map((produce) => produce(ctx)), opts.interactive === true);
    cur = ran.state;
    events.push(...ran.events);
    if (cur.pending) return { state: cur, events }; // refills/outcome settle on resolution
  }
  // The card has fully resolved; if it emptied a hand, "run out of cards"
  // refills now (playing your last card counts — see settleHandRefills).
  const settled = settleHandRefills(cur);
  cur = settled.state;
  events.push(...settled.events);
  const outcome = outcomeAction(cur);
  if (outcome) run([outcome]);
  return { state: cur, events };
}

/**
 * Resolve the pending card choice with the player's picked copies (`uids`),
 * then resume the suspended resolution. The picks are validated — only cards
 * actually in the owner's hand (and Unplayable, for a burn) count, and exactly
 * `pending.count` are required — so a stale or forged selection is refused
 * rather than half-applied. Resuming may pause again on the next choice.
 */
export function resolvePendingChoice(state: GameState, uids: readonly number[]): RunResult {
  const pending = state.pending;
  if (!pending) return { state, events: [] };
  const c = combatantOf(state, pending.owner);
  const eligible = new Set(
    (c?.hand ?? [])
      .filter((inst) => pending.kind === 'discard' || inst.unplayable === true)
      .map((inst) => inst.uid),
  );
  const chosen = [...new Set(uids)].filter((uid) => eligible.has(uid));
  if (chosen.length !== pending.count) return { state, events: [] };

  let cur = state;
  const events: GameEvent[] = [];
  const run = (r: RunResult) => {
    cur = r.state;
    events.push(...r.events);
  };

  run(runWithTriggers(cur, [{ type: 'ClearPendingChoice' }]));
  // queued[0] is the very action that paused; re-issue it with the picks.
  const [head, ...rest] = pending.queued;
  if (head && (head.type === 'DiscardCards' || head.type === 'BurnCards')) {
    run(runWithTriggers(cur, [{ ...head, uids: chosen }]));
  }
  if (!finished(cur)) run(runOrPause(cur, rest, true));
  if (cur.pending) return { state: cur, events };

  run(settleHandRefills(cur));
  const outcome = outcomeAction(cur);
  if (outcome) run(runWithTriggers(cur, [outcome]));
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

/**
 * Enforce the cloud cap for an AI actor: while it holds more than its cap
 * clouds, drop the oldest (so freshly-created clouds "replace" older ones). The
 * human does this interactively; the AI just keeps the newest.
 */
export function capClouds(state: GameState, ownerId: EntityId): RunResult {
  let s = state;
  const events: GameEvent[] = [];
  let c = combatantOf(s, ownerId);
  let guard = 0;
  while (c && c.clouds.length > cloudCapFor(c) && guard++ < 20) {
    const r = runWithTriggers(s, [{ type: 'RemoveCloudAt', target: ownerId, index: 0 }]);
    s = r.state;
    events.push(...r.events);
    c = combatantOf(s, ownerId);
  }
  return { state: s, events };
}

/**
 * Can `actor` legally play the card at `index` right now? Energy, the
 * Unplayable keyword, and Burn costs all gate it. Shared by `playFromHand`, the
 * AI's `validPlays`, and the UI's hand display, so they can never disagree —
 * an AI offered a play the engine then refuses would loop.
 */
export function canPlayAt(actor: Combatant, index: number): boolean {
  const instance = actor.hand[index];
  const card = instance ? getCard(instance.cardId) : undefined;
  if (!instance || !card) return false;
  if (actor.energy < card.cost) return false;
  // Unplayable: never from hand — Burn spends it instead.
  if (instance.unplayable) return false;
  // Burn is a cost (Highlighter: "…does not COST unplayable cards to play"):
  // without enough Unplayable cards in hand, the card can't be played.
  const cost = burnCostOf(card);
  return cost === 0 || actor.hand.filter((i) => i.unplayable).length >= cost;
}

/** Hand indices a combatant may legally play right now (in hand + affordable). */
function validPlays(actor: Combatant): number[] {
  const idxs: number[] = [];
  for (let i = 0; i < actor.hand.length; i++) {
    if (canPlayAt(actor, i)) idxs.push(i);
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
  const cardId = actor.hand[index]!.cardId;
  // Choose a target at random among the opponent's hero and its minions — a
  // minion soaks the whole attack (and dies), so spreading fire makes minions
  // matter. Only affects the card's damage; self-buffs still hit the caster.
  const opp = opponentsOf(state, actorId).find((o) => o.hp > 0);
  let rng = draw.state;
  let target = opp?.id ?? actorId;
  if (opp && opp.minions.length > 0) {
    const candidates: EntityId[] = [opp.id, ...opp.minions.map((m) => m.id)];
    const pick = nextInt(rng, 0, candidates.length - 1);
    rng = pick.state;
    target = candidates[pick.value]!;
  }
  const played = settleAfter(playFromHand({ ...state, rng }, actorId, index, target));
  const capped = capClouds(played.state, actorId); // AI keeps at most its cloud cap
  return { state: capped.state, events: [...played.events, ...capped.events], cardId };
}

// ---- The enemy turn, decomposed so the UI can pace it -----------------------
// `endPlayerTurn` composes these synchronously (tests / headless); the game view
// calls them one at a time with timers between (3s before the turn, 1s per card).

/**
 * The player's own end-of-turn (persistents, fog discard); leaves `enemyTurn`.
 * Interactively, a Fog discard with a real choice pauses here (`state.pending`)
 * — the caller waits for `resolvePendingChoice`, which runs the queued EndTurn.
 */
export function endPlayerPhase(state: GameState, opts: { interactive?: boolean } = {}): RunResult {
  if (finished(state) || state.pending) return { state, events: [] };
  return settleAfter(endTurn(state, opts));
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
