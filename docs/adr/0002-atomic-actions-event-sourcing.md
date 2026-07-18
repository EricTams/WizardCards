# ADR 0002 — Atomic actions, pure reducer, event sourcing, seeded RNG

**Status:** accepted · Phase 0

## Context

The game is single-player first but may become multiplayer. We also need every card to be testable with edge cases, and we want replay/undo. Retrofitting a clean state model later is expensive.

## Decision

Model all state change as **atomic actions** applied by a **pure, total, deterministic reducer** `apply(state, action) => { state, events }`. `GameState` is **plain JSON-serializable data**. All randomness flows through a **seeded RNG whose cursor lives inside `GameState`**. The ordered **action log** replayed over `initialState(seed)` reconstructs any state (event sourcing).

## Consequences

- **Free:** deterministic tests, replay, undo/time-travel, snapshots, and the netcode model (send actions, not snapshots).
- **Cost/discipline:** no class instances/functions/`Date`/`Map`/`Set` in state; no `Math.random` anywhere in the engine; the reducer must stay pure and exhaustive. These are enforced by convention + tests (serializable round-trip test, `assertNever` guard).
- The UI must treat state as read-only and derive everything from `state` + `events`.

## Alternatives considered

- **Mutable OO game objects with methods** — simplest to write first, but breaks serialization, determinism, and multiplayer; rejected.
- **Redux/library** — the pattern, not the dependency, is what we need; a tiny hand-rolled reducer keeps the engine dependency-free.
