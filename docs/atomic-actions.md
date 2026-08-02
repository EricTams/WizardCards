# Atomic Actions & the Reducer

This is the contract that makes the game deterministic, replayable, testable, and multiplayer-ready.

## Two tiers, both serializable

- **Intent / Move** — what a player *requests*: "play card #3 on enemy #1". Validated against the rules. (Not yet implemented in the skeleton.)
- **Atomic action** — the smallest deterministic mutation the engine understands. A validated move expands into an ordered list of these. A card's compiled effects are atomic actions.

Both are plain objects with a `type` discriminant. See `src/engine/actions/index.ts` for the `Action` union. Today it covers:

- **Cards & turn:** `StartTurn`, `EndTurn`, `SetPhase` (drive the phase directly — used for `mulligan`/`won`/`lost`), `ClearBlock`, `DrawCards`, `DiscardCards`, `MoveHandCardToDiscard` (move a specific hand card, by index — how playing a card leaves the hand).
- **Card choices:** `DiscardCards`/`BurnCards` accept optional `uids` — the copies a player *chose* (without them, the deterministic default: rightmost for discards, leftmost-Unplayable for burns). `SetPendingChoice` pauses the battle on such a choice, carrying the suspended remainder of the resolution as plain actions in `GameState.pending.queued`; `ClearPendingChoice` lifts it. The pause is data, so a mid-choice state serializes and replays like any other — the cards layer raises it only for a human with a real pick to make (`runOrPause`), and resumes via `resolvePendingChoice`.
- **Combat resources:** `DealDamage` (soaks `block` first, then persistent `shield`, then `hp`), `DealDamageToRandomEnemy` (a random living *opponent* of `self` via `state.rng`), `DealDamageScaled` (`multiplier × metricValue(state, self, per)` — "equal to your energy", "for each unique cloud"), `GainBlock`, `GainShield`, `Heal` (capped at `maxHp`), `GainEnergy`, `SetEnergy` (set to an exact value — the per-turn reset to base), `GainPoison`, `GainPower`, `GainBravery`.
- **Clouds:** `CreateClouds` (type + count), `RemoveClouds`.
- **Poison keywords:** `Venom` (deal damage = caster's Poison, then zero it) and `Drink` (gain block = Poison, then zero it) — the "equal to your Poison" scaling resolves here, at reduce time, so it stays deterministic.
- **Minions & persistents:** `SummonMinion` (a copy of a card; instance ids are minted from `GameState.idSeq`), `DiscardMinion`, `AddPersistent`.

### Ownership: who does the action act on?

`GameState` holds the player and the enemies, and **each combatant carries its own card piles** (`drawPile`/`hand`/`discardPile`/`exhaustPile` live on `Combatant`, not on `GameState`). This is what lets the enemy draw and play cards through the exact same reducer as the player — the symmetric, multiplayer-ready shape the design wants.

So pile/perspective actions take an owner: `DrawCards`, `DiscardCards`, and `MoveHandCardToDiscard` carry an optional `owner` (defaults to the player), and `DealDamageToRandomEnemy` carries an optional `self` whose *opponents* it targets (`opponentsOf(state, self)` — the enemies if `self` is the player, else the player). The card DSL threads `ctx.self` into these so a card an enemy plays draws from the enemy's deck and hits the enemy's opponents.

Each action emits a matching `GameEvent` (`ShieldGained`, `Healed`, `CloudsCreated`, `MinionSummoned`, `PhaseChanged`, `EnergySet`, …) so the game log can render every effect. `CardsDrawn`/`CardsDiscarded`/`DeckReshuffled` carry the `owner` they happened to. Two events carry extra data specifically for triggers: `DamageDealt.unblocked` (the portion past block+shield) and `CloudsRemoved.removed` (which cloud types went away). Adding an action means adding its event and a log rendering.

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

### The game log (implemented)

The game has a **game log** (a.k.a. combat log): a human-readable, chronological record of everything that happens in a run. It is a required, first-class feature — **now built** in the battle view (`src/ui/game/combatLog.ts` formats events; `BattleScreen`'s `CombatLog` panel renders a titled block per card play / turn with its effect lines beneath). It reads the `events` returned by each driver step and never inspects state.

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
