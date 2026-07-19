# Architecture

## Layers

```
┌─────────────────────────────────────────────┐
│ ui        React. Card Lab + game view.        │  imports ↓ only
│           Renders state, dispatches intents.  │
├─────────────────────────────────────────────┤
│ cards     English DSL + card data + registry. │  imports ↓ only
├─────────────────────────────────────────────┤
│ engine    Pure core: state, atomic actions,   │  imports ↓ only
│           reducer, seeded RNG.                 │
├─────────────────────────────────────────────┤
│ shared    ids, Result/Diagnostic, brands.     │  imports nothing
└─────────────────────────────────────────────┘
```

**The dependency rule:** imports only point downward (`ui → cards → engine → shared`). This is enforced by `eslint.config.js` (`@typescript-eslint/no-restricted-imports` keyed on the `@ui/@cards/@engine/@shared` path aliases). Attempting `engine`→`ui` fails lint.

Why one-way dependencies matter:
- The **engine** never references the display, so it can run headless (tests, a server) unchanged.
- The **display** can be rewritten or swapped (React → anything) without touching game logic.
- For multiplayer, the engine becomes the authoritative server reducer with no code changes to its core.

## How a move flows

```
player clicks "play Strike on Goblin"
   │
   ▼  (ui) builds an INTENT: { playCard: strikeId, target: goblinId }
   │
   ▼  (rules) validate the intent against GameState  ──► rejected? show why, state unchanged
   │
   ▼  (cards) compile the card's English text ─► action PRODUCERS
   │
   ▼  bind producers to context (self, target) ─► a list of ATOMIC ACTIONS
   │
   ▼  (engine) apply each action: apply(state, action) => { state, events }
   │
   ▼  new GameState (pure data) + events
   │
   ▼  (ui) re-render from new state; play animations from events
```

The UI holds the current `GameState` (or subscribes to it) but **never mutates it** — it only produces intents and renders results. Intents and atomic actions are both serializable, which is exactly what a network layer needs.

> Formal intent validation is still thin; `playFromHand` (the battle driver) does the load-bearing checks today — right phase, card in hand, enough energy — before it spends energy and resolves the card. See `docs/roadmap.md`.

## The single-battle loop

`src/cards/match/battle.ts` drives a whole match on top of the turn orchestrator and the reducer:

- `newBattle({ character, relicId, seed })` builds both combatants with shuffled 20-card decks, fires the relic's combat-start effects, deals opening hands, and pauses in the `mulligan` phase.
- `confirmMulligan` discards the chosen 2 and begins turn 1.
- `playFromHand(state, actor, index, target?)` validates and plays one card (spend energy → move it to discard → resolve effects with triggers → settle win/lose).
- `endPlayerTurn` runs the player's end-of-turn, then the **enemy's whole turn through the same machinery** — the opponent has its own deck/hand and plays real cards via `playFromHand` (its AI picks a random legal card each step) — then begins the next player turn. The turn is also exposed as discrete steps (`beginEnemyTurn`/`enemyPlayOne`/`beginPlayerTurn`) so the game view can pace it; see `docs/battle.md`.

Because every combatant owns its piles and everything flows through the reducer, a battle is a pure function of `(seed, player moves)`: deterministic, replayable, and (later) netcode-ready.

## The two core subsystems

- **Atomic actions & the reducer** — how state changes. See `docs/atomic-actions.md`.
- **The card English processor** — how text becomes actions. See `docs/card-dsl.md`.
- **The battle loop & game view** — how a match is played and drawn. See `docs/battle.md`.

## Serialization boundary

`GameState` is plain JSON. `structuredClone(state)` and `JSON.parse(JSON.stringify(state))` must round-trip losslessly (there's a test for this). Card *definitions* and compiled *producers* are not part of state — the engine references cards by `CardId` and looks them up in the registry.

## Deployment

Static build via Vite (`base: '/WizardCards/'`) → GitHub Pages via Actions (`.github/workflows/deploy.yml`). No backend for single-player.

**SPA routing:** the app uses **hash routing** (`useHashRoute`) so deep links don't 404 on Pages — `#/play` is the game (character/relic select → battle), `#/cardlab` is the Card Lab, and everything else is the main menu.

**Art:** the hand-drawn sprites in `assets/art/…` are served via Vite's `publicDir` (set to `assets`), so they resolve at `<base>art/…` in dev and copy into `dist/` on build. `src/ui/game/art.ts` maps cards/heroes/clouds to those URLs and carries sprite-sheet metadata; **numeric UI values (HP, energy, block, …) are always HTML, never art.**
