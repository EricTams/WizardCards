# Triggers & the turn loop

Cards don't just do their own effects — play cascades. Creating a cloud can make a persistent deal damage, which makes another persistent add poison; the start of a turn fires every cloud and replays every minion. This document describes the layer that resolves that cascade.

## Why it lives in `cards`, not `engine`

The engine reducer is deliberately **atomic and trigger-free**: `apply(state, action)` is one action → one mutation, exhaustive and pure (see `docs/atomic-actions.md`). It has no knowledge of clouds' *meanings* or of card text.

But resolving triggers needs both:
- the **reducer** (to apply the follow-up actions), and
- the **card DSL** (a minion *replays its compiled card text*; authored persistents will too).

The only layer that can import both is `cards` (`ui → cards → engine → shared`). So the orchestration lives in **`src/cards/match/`**, above the engine, below the UI. The engine stays a clean, replayable core.

## Determinism is preserved

Triggers are a **pure function of state + the event that fired them**. All randomness still flows through engine actions (`state.rng`) — e.g. a Storm cloud's "damage a random enemy" is the `DealDamageToRandomEnemy` atomic action, which advances `state.rng` inside the reducer. Because triggers derive from state, they need not be recorded: **replaying the primary actions reproduces every triggered effect**, so the action log stays the source of truth.

## The two kinds of trigger

### Reactive — "whenever X happens"
After each atomic action, the orchestrator looks at the `GameEvent`s it emitted and asks every active persistent whether it reacts. Reactions are themselves actions, applied in turn, whose events may trigger more — a queue drained to a fixpoint (with a large safety cap against pathological loops).

```
applyWithTriggers(state, action):
  base = apply(state, action)                 // engine
  queue = base.events
  while queue not empty:
    event = queue.shift()
    for followup in reactiveTriggers(state, event):
      r = apply(state, followup); queue.push(r.events)
```

Some events carry extra data precisely so triggers can key off them: `DamageDealt.unblocked` (Rot Away — "unblocked damage") and `CloudsRemoved.removed` (Static — "a Lightning cloud is removed").

### Molt — the card itself is the trigger

Persistents react from the play area and minions replay from the board, but the Crab's **Molt** reacts *as the card leaves the hand*: "whenever this card is discarded, it plays for free". So it can't be a persistent — the card isn't in play — and it hangs off the `CardsDiscarded` event instead, in `src/cards/match/molt.ts`. `reactiveTriggers` returns the union of the two sources, and the free plays join the same cascade as everything else, so a discarded Molt card that itself discards keeps the chain going (bounded by the same `TRIGGER_CAP`).

"For free" is literal: nothing in that path touches energy, because the card was never played from a hand.

**Not every trip to the discard pile is a discard.** `CardsDiscarded` carries a `reason`:

| `reason`   | When                                              | Molt fires? |
|------------|---------------------------------------------------|-------------|
| `discard`  | "Discard 2 cards", the end-of-turn Fog penalty    | **yes**     |
| `play`     | a card moving to the pile as it is played         | no          |
| `setup`    | the opening mulligan, before the battle begins    | no          |

The distinction is load-bearing rather than cosmetic. Playing a card moves it to the discard pile through the very same event, so firing on `play` would play every Molt card **twice**; and the mulligan is a setup step, where a Molt card would otherwise resolve before turn 1. The same rule governs the `cardsDiscardedThisTurn` counter, which only `discard` increments.

**Minion replay is announced.** Replaying a minion is orchestrated by the cards layer, not by an action, so it would otherwise be invisible to triggers. `runTurnCascade` runs a `NoteMinionReplayed` bookkeeping action before each pass, raising a `MinionReplayed` event that "when a minion is replayed" (Juggle) keys off — including the extra passes Protect the Drinks adds. `NoteCardPlayed` does the same job for the per-turn cards-played count.

### Phase — start / end of turn
`startTurn` sequences: advance the turn → clear temporary block → fire each **cloud** (Lightning→energy, Snow→heal, Storm→damage a random enemy, Fog→draw) → run start-of-turn persistents (Summer) → **replay each minion** (its compiled text minus re-summoning itself) → draw. `endTurn` makes Fog clouds force a discard (unless Fall) and ends the turn. Each step resolves its own reactive cascade before the next.

## Persistents — authored in English

Persistents are **ordinary cards, authored in English** (`src/cards/definitions/cloud-persistents.ts`, `wizard-persistents.ts`) and registered in `ALL_CARDS` like everything else. `compilePersistent(text)` (`src/cards/match/compile-persistent.ts`) parses the trigger grammar (`docs/card-dsl.md`) into the hooks the orchestrator consults: `onEvent` (reactive), `onStartTurn`/`onEndTurn` (phase), and the modifiers `snowHealBonus` (Winter) / `suppressFogDiscard` (Fall). Compilation is memoized by card id since text is static.

Modeled today: **Winter, Fall, Spring, Summer, Static** (Cloud) and **Rot Away, Consuming** (Wizard). Because a persistent's statements are all triggers/modifiers, `compile()` yields **zero on-play actions** — playing/registering one does nothing until it's in the play area. `PERSISTENT_CARDS` is the subset of the registry that behaves this way.

To add a persistent, write its English text as a card and it just works — no code, provided the trigger grammar covers its wording. Behavior that the grammar can't yet express (e.g. Wild Wind's cloud churn, "replayed N extra times") is the remaining gap, not the persistents themselves.

## Using it

- **Play a card with triggers:** `playCard(state, card, ctx)` → `{ state, events }`.
- **Advance turns:** `startTurn(state, { draw })` / `endTurn(state)`.
- **Put a persistent in play:** the `AddPersistent` atomic action (the Card Lab's "Add a persistent" dropdown), or set `player.persistents` in a `CardTest` setup.

The **Card Lab Play test** routes card play and the Start/End-turn buttons through this module, and the game view shows resource/cloud/minion/persistent chips, so you can watch a cascade happen.

## Not yet built

*"replayed N extra times"* persistents; end-of-turn cloud churn (Wild Wind, Windmill); more trigger events (on-draw, on-block, on-gain) and richer conditions. (Minion *damage-soak* — a minion takes a hit in your place — and the cloud cap of 3 are now implemented; see `docs/battle.md`.)
