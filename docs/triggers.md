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

### Phase — start / end of turn
`startTurn` sequences: advance the turn → clear temporary block → fire each **cloud** (Lightning→energy, Snow→heal, Storm→damage a random enemy, Fog→draw) → run start-of-turn persistents (Summer) → **replay each minion** (its compiled text minus re-summoning itself) → draw. `endTurn` makes Fog clouds force a discard (unless Autumn) and ends the turn. Each step resolves its own reactive cascade before the next.

## Persistents — authored in English

Persistents are **ordinary cards, authored in English** (`src/cards/definitions/cloud-persistents.ts`, `wizard-persistents.ts`) and registered in `ALL_CARDS` like everything else. `compilePersistent(text)` (`src/cards/match/compile-persistent.ts`) parses the trigger grammar (`docs/card-dsl.md`) into the hooks the orchestrator consults: `onEvent` (reactive), `onStartTurn`/`onEndTurn` (phase), and the modifiers `snowHealBonus` (Winter) / `suppressFogDiscard` (Autumn). Compilation is memoized by card id since text is static.

Modeled today: **Winter, Autumn, Spring, Summer, Static** (Cloud) and **Rot Away, Consuming** (Wizard). Because a persistent's statements are all triggers/modifiers, `compile()` yields **zero on-play actions** — playing/registering one does nothing until it's in the play area. `PERSISTENT_CARDS` is the subset of the registry that behaves this way.

To add a persistent, write its English text as a card and it just works — no code, provided the trigger grammar covers its wording. Behavior that the grammar can't yet express (e.g. Wild Wind's cloud churn, "replayed N extra times") is the remaining gap, not the persistents themselves.

## Using it

- **Play a card with triggers:** `playCard(state, card, ctx)` → `{ state, events }`.
- **Advance turns:** `startTurn(state, { draw })` / `endTurn(state)`.
- **Put a persistent in play:** the `AddPersistent` atomic action (the Card Lab's "Add a persistent" dropdown), or set `player.persistents` in a `CardTest` setup.

The **Card Lab Play test** routes card play and the Start/End-turn buttons through this module, and the game view shows resource/cloud/minion/persistent chips, so you can watch a cascade happen.

## Not yet built

Minion *damage-soak* (a minion takes a hit in your place) and *"replayed N extra times"* persistents; end-of-turn cloud churn (Wild Wind, Windmill — gated on a cloud-slot cap that doesn't exist yet); more trigger events (on-draw, on-block, on-gain) and richer conditions; and enemy turns / a real turn structure (Phase 2).
