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
- **AST / CardScript / EffectNode** — the parsed structure of a card's text: `effects` (on-play) + `triggers` (ongoing) + `modifiers` (static rule changes). (`src/cards/dsl/ast`)
- **Producer (ActionProducer)** — a function `(PlayContext) => Action` returned by the resolver; binds runtime context (self/target) to yield concrete atomic actions. (`src/cards/dsl/resolver`)
- **compile** — run the whole DSL pipeline: `text → parse → resolve → ActionProducer[]`. (`src/cards/index`)
- **Diagnostic** — an error/warning tied to a `[start, end)` span in the source text, used by the Card Lab. (`src/shared`)
- **Combatant** — the player or an enemy: id, hp/maxHp, the resources `block`, `shield`, `energy`, `poison`, `power`, `bravery`, the per-turn counter `discardedThisTurn`, plus `clouds[]`, `minions[]`, and `persistents[]`. Build one with `makeCombatant()`. (`src/engine/state`)
- **Trigger / turn orchestration (`match`)** — the layer that resolves trigger cascades and the turn loop (`playCard`, `startTurn`, `endTurn`). Lives in `cards` because it needs both the reducer and the DSL; the engine stays atomic. (`src/cards/match`, `docs/triggers.md`)
- **PersistentBehavior** — the runtime hooks a persistent card compiles to (`onEvent` / `onStartTurn` / `onEndTurn` + `snowHealBonus`/`suppressFogDiscard` modifiers). Produced by `compilePersistent(text)` from the card's English trigger grammar. (`src/cards/match/compile-persistent`)
- **Trigger grammar** — the DSL for authoring ongoing rules: `When[ever]/At <event>[, if <condition>], <effects>` plus cloud *modifier* sentences and `to all/random opponent` targeting. Parses into `TriggerNode`/`ModifierNode` (`docs/card-dsl.md`).
- **Scaling / ScaleMetric** — a `deal` amount measured against the caster at play time ("equal to your energy", "3 for each unique cloud"). Parsed as `EffectNode.scale`, resolved by the `DealDamageScaled` action + `metricValue`. (`src/shared`, `docs/card-dsl.md`)
- **CardTest** — a serializable per-card test: a setup (starting state), the card to play, and expected results. Run by the pure `runCardTest`, shared by the Vitest suite and (soon) the Card Lab. (`src/cards/testing`, `src/cards/card-tests`, `docs/card-testing.md`)
- **Card Lab** — the in-game tool (reachable at `#/cardlab`) to browse/edit/test cards and export a diff report. Has Edit and Play test modes. (`src/ui/cardlab`, `docs/card-lab.md`)
- **GameView** — the reusable renderer of a GameState (player + enemies). Read-only in the real game; the Card Lab passes handlers to make the target row an editable play area. (`src/ui/game/GameView`)
- **Arena** — the Card Lab's sandbox GameState you configure with targets and play cards against. (`src/ui/cardlab/arena`)
- **CardOverrides** — a serializable overlay of edits (edited/added/removed cards) on top of the baseline registry; what the Card Lab persists to localStorage. (`src/cards/overrides`)
- **Diff report** — the exported JSON describing added/modified/removed cards vs. baseline; a user sends it back to patch the card list. (`src/cards/diff`)
- **Layer** — one of `shared` / `engine` / `cards` / `ui`; imports only point rightward (see `docs/architecture.md`).

## Game design terms

Vocabulary from the game design (`reference/design.md`). Some are now modeled in the engine (noted per entry); the rest are still **design terms** recorded so docs and future code agree on wording.

- **Character** — one of the five playable kits (Cloud, Crab, Wizard, Old Lady, Writer), each with a signature mechanic and its own ~40-card pool.
- **Pool / Deck** — a character's ~40 cards are its *pool*; the 20-card *deck* you play is drawn from that pool.
- **Relic** — a passive combat modifier; you're offered 3 and keep 1. Split into a general pool plus per-character relics.
- **Energy** — the play resource (start with 1); "play X more cards". Distinct from a card's `cost`; economy details are an open question (see `vision.md`).
- **Block** — *temporary* damage absorption. Modeled as `Combatant.block`; damage soaks it first. (Turn-based clearing arrives with the turn structure.)
- **Shield** — *persistent* damage absorption that carries across turns. Modeled as `Combatant.shield`; damage soaks it after block, before hp. (Per-card shield stacks from the design are simplified to one pool for now.)
- **Heal / Discard** — gain HP up to max (`Heal` action) / move cards from hand to the discard pile.
- **Power** (Old Lady) — bonus damage applied to your first attack each turn. Stored as `Combatant.power` (the first-attack bonus isn't applied yet).
- **Bravery** (Writer) — stored value that boosts the first block card you play. Stored as `Combatant.bravery` (the boost isn't applied yet).
- **Poison / Venom / Drink** (Wizard) — Poison stores an X value (`Combatant.poison`); **Venom** deals damage equal to it, **Drink** converts it to block, both resetting Poison to 0. All three are modeled (`GainPoison`/`Venom`/`Drink` actions).
- **Cloud** (Cloud) — a token; four types — **Lightning** (+energy), **Snow** (heal), **Fog** (+draw, then end-of-turn discard), **Storm** (damage a random enemy). Modeled as `Combatant.clouds[]`; created/removed by actions and **fired at the start of the turn** by the `match` orchestrator (`docs/triggers.md`).
- **Molt** (Crab) — a card keyword, authored as `Molt.` in the card's text: when the card is **discarded** it plays for free. Fires off the `CardsDiscarded` event only when its `reason` is `discard` — not when a card merely moves to the pile by being played, nor during the opening mulligan. (`src/cards/match/molt.ts`, `docs/triggers.md`)
- **Minion** (Wizard) — a card that stays in play and **replays at the start of your turn** (its compiled text minus re-summoning itself). Modeled: `Combatant.minions[]`, `SummonMinion`/`DiscardMinion`, and the start-of-turn replay. Still to do: soaking a hit in your place.
- **Blank / Add** (Old Lady) — a Blank card enables **Add** cards (which can't be played normally) to be played for free until a non-Add/Blank card is played.
- **Unplayable / Burn / Find** (Writer) — Unplayable cards can't be played normally; Burn discards them to trigger their effects; Find draws with an extra effect when an Unplayable is drawn.
- **Persistent** — an ongoing card that stays in play and keeps applying its effect (all five characters have some). Modeled as `Combatant.persistents[]` + `PersistentDef` trigger behavior; a first set (Winter, Fall, Spring, Summer, Static, Rot Away, Consuming) is live. See `docs/triggers.md`.
