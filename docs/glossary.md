# Glossary

Shared vocabulary so docs and code use the same words. Names here should match type/identifier names in the code.

- **GameState** — the complete, plain-JSON snapshot of a game. The single source of truth. (`src/engine/state`)
- **Intent / Move** — a player's *request* ("play card X on target Y"), validated against the rules before it changes anything. (Not yet implemented.)
- **Atomic action** (a.k.a. **Action**) — the smallest deterministic state mutation the reducer understands (`DealDamage`, `GainBlock`, `DrawCards`, `StartTurn`). A move expands into a list of these. (`src/engine/actions`)
- **Reducer / `apply`** — the pure function `apply(state, action) => { state, events }`. (`src/engine/reducers`)
- **Event (GameEvent)** — a description of something that happened during `apply` (e.g. `DamageDealt`), consumed by the UI for animation/logging. Not state.
- **Game log** (a.k.a. combat log) — the required chronological, human-readable record of a run, rendered from the `GameEvent` stream (never from state). See `docs/atomic-actions.md`.
- **Action log** — the ordered list of applied actions. Replaying it over `initialState(seed)` reproduces any state (event sourcing).
- **RNG / seed** — the deterministic pseudo-random generator whose cursor lives in `state.rng`. Same seed + same actions ⇒ identical state. (`src/engine/rng`)
- **Card / CardDef** — a card's data: id, name, cost, and English `text`. (`src/cards/registry`, `src/cards/definitions`)
- **Registry** — the enumerable list of all cards (`ALL_CARDS`); drives the data-driven test suite. (`src/cards/registry`)
- **DSL / card language** — the small English grammar cards are written in. (`docs/card-dsl.md`)
- **Token** — a lexical unit (word/number/punctuation) with a source span. (`src/cards/dsl/tokenizer`)
- **AST / CardScript / EffectNode** — the parsed structure of a card's text. (`src/cards/dsl/ast`)
- **Producer (ActionProducer)** — a function `(PlayContext) => Action` returned by the resolver; binds runtime context (self/target) to yield concrete atomic actions. (`src/cards/dsl/resolver`)
- **compile** — run the whole DSL pipeline: `text → parse → resolve → ActionProducer[]`. (`src/cards/index`)
- **Diagnostic** — an error/warning tied to a `[start, end)` span in the source text, used by the Card Lab. (`src/shared`)
- **Combatant** — the player or an enemy: id, hp/maxHp, block. (`src/engine/state`)
- **Card Lab** — the in-game tool (reachable at `#/cardlab`) to browse/edit/test cards and export a diff report. Has Edit and Play test modes. (`src/ui/cardlab`, `docs/card-lab.md`)
- **GameView** — the reusable renderer of a GameState (player + enemies). Read-only in the real game; the Card Lab passes handlers to make the target row an editable play area. (`src/ui/game/GameView`)
- **Arena** — the Card Lab's sandbox GameState you configure with targets and play cards against. (`src/ui/cardlab/arena`)
- **CardOverrides** — a serializable overlay of edits (edited/added/removed cards) on top of the baseline registry; what the Card Lab persists to localStorage. (`src/cards/overrides`)
- **Diff report** — the exported JSON describing added/modified/removed cards vs. baseline; a user sends it back to patch the card list. (`src/cards/diff`)
- **Layer** — one of `shared` / `engine` / `cards` / `ui`; imports only point rightward (see `docs/architecture.md`).
