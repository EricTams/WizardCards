# Atomic Actions & the Reducer

This is the contract that makes the game deterministic, replayable, testable, and multiplayer-ready.

## Two tiers, both serializable

- **Intent / Move** — what a player *requests*: "play card #3 on enemy #1". Validated against the rules. (Not yet implemented in the skeleton.)
- **Atomic action** — the smallest deterministic mutation the engine understands. A validated move expands into an ordered list of these. A card's compiled effects are atomic actions.

Both are plain objects with a `type` discriminant. See `src/engine/actions/index.ts` for the `Action` union. Today it covers:

- **Cards & turn:** `StartTurn`, `EndTurn`, `ClearBlock`, `DrawCards`, `DiscardCards`.
- **Combat resources:** `DealDamage` (soaks `block` first, then persistent `shield`, then `hp`), `DealDamageToRandomEnemy` (picks a target via `state.rng`), `DealDamageScaled` (`multiplier × metricValue(state, self, per)` — "equal to your energy", "for each unique cloud"), `GainBlock`, `GainShield`, `Heal` (capped at `maxHp`), `GainEnergy`, `GainPoison`, `GainPower`, `GainBravery`.
- **Clouds:** `CreateClouds` (type + count), `RemoveClouds`.
- **Poison keywords:** `Venom` (deal damage = caster's Poison, then zero it) and `Drink` (gain block = Poison, then zero it) — the "equal to your Poison" scaling resolves here, at reduce time, so it stays deterministic.
- **Minions & persistents:** `SummonMinion` (a copy of a card; instance ids are minted from `GameState.idSeq`), `DiscardMinion`, `AddPersistent`.

Each action emits a matching `GameEvent` (`ShieldGained`, `Healed`, `CloudsCreated`, `MinionSummoned`, …) so the game log can render every effect. Two events carry extra data specifically for triggers: `DamageDealt.unblocked` (the portion past block+shield) and `CloudsRemoved.removed` (which cloud types went away). Adding an action means adding its event and a log rendering.

**Triggers are NOT here.** The reducer stays atomic and trigger-free. The cascade that turns "create a cloud" into a persistent's damage, and the per-turn firing of clouds/minions, is resolved one layer up in `src/cards/match` — see `docs/triggers.md`. That layer composes this reducer with the card DSL; replaying the primary actions still reproduces every triggered effect.

## The reducer contract

```ts
apply(state: GameState, action: Action): { state: GameState; events: GameEvent[] }
```

- **Pure** — no I/O, no `Date`, no `Math.random`, no mutation of the input.
- **Total** — every `Action` variant is handled; the `switch` ends in an `assertNever` exhaustiveness guard, so adding a variant without handling it is a compile error.
- **Deterministic** — all randomness reads/advances `state.rng`.

`applyAll(state, actions)` folds a whole sequence, accumulating events. This is the event-sourcing core:

```
state = applyAll(initialState(seed), actionLog).state
```

## Events vs. state

`apply` returns `events` (e.g. `DamageDealt`, `CardsDrawn`, `DeckReshuffled`) describing *what happened*. State is the truth the UI renders; events drive transient concerns like animations and the game log. **The UI reads state and reacts to events; it never writes either.**

### Requirement: the game log

The game has a **game log** (a.k.a. combat log): a human-readable, chronological record of everything that happens in a run. It is a required, first-class feature.

- **Source of truth is the `events` stream, not state.** The log is built by formatting `GameEvent`s as they are emitted by the reducer — it must never be produced by diffing or inspecting `GameState`. This keeps the log accurate for effects that don't leave a lasting state trace and reinforces the event-sourcing model.
- **Deterministic & replayable.** Because events derive from `applyAll(initialState(seed), actionLog)`, the same seed + action log reproduces the identical log. The log is therefore reconstructable from the action log alone (no separate persistence needed).
- **Every event is loggable.** Each `GameEvent` variant must carry enough data to render a clear line (who, what, how much). Adding an event variant means giving it a log rendering.
- **Where it appears:** in the real game view during play, and in the Card Lab's Play test mode (so authors see exactly what a card does, event by event).
- **Serializable & multiplayer-friendly:** since it is a projection of the broadcast action/event stream, all clients derive the same log.

Formatting `GameEvent → string` is presentation and belongs in the `ui` layer; the engine only emits structured events.

## Determinism & the RNG

The RNG's entire state is a single number living inside `GameState.rng` (`src/engine/rng`, mulberry32). Every draw returns `{ value, state }` — it never mutates in place and never touches `Math.random`. Therefore:

> **Same seed + same action sequence ⇒ byte-identical state, always.**

This single guarantee buys us:

- **Replay** — persist the action log; replay it to reconstruct any state.
- **Undo / time-travel** — re-fold a prefix of the log.
- **Deterministic tests** — assert exact resulting state; property tests fuzz action sequences.
- **Netcode** — send *actions*, not snapshots; clients predict and reconcile; late-joiners get a snapshot + subsequent actions.

## Serialization rules (do / don't)

- ✅ Plain objects, arrays, numbers, strings, booleans, `null`.
- ✅ Reference cards/entities by id (`CardId`, `EntityId`); resolve details from registries outside state.
- ❌ No class instances, functions, `Date`, `Map`, `Set`, `undefined`-holes-that-matter in the state tree.
- Invariant test: `JSON.parse(JSON.stringify(state))` deep-equals `state`.

## Multiplayer sketch (future, not built)

Server owns the authoritative reducer. Clients submit **intents**; server validates, expands to **atomic actions**, applies them, and broadcasts the actions (+ resulting seed cursor). Deterministic RNG lets clients apply the same actions and stay in sync. Snapshots are just serialized `GameState`.
