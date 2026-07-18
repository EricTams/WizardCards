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

> Intent validation is not built yet in the skeleton; the Card Lab currently compiles text straight to actions and applies them to a sandbox state. See `docs/roadmap.md`.

## The two core subsystems

- **Atomic actions & the reducer** — how state changes. See `docs/atomic-actions.md`.
- **The card English processor** — how text becomes actions. See `docs/card-dsl.md`.

## Serialization boundary

`GameState` is plain JSON. `structuredClone(state)` and `JSON.parse(JSON.stringify(state))` must round-trip losslessly (there's a test for this). Card *definitions* and compiled *producers* are not part of state — the engine references cards by `CardId` and looks them up in the registry.

## Deployment

Static build via Vite (`base: '/WizardCards/'`) → GitHub Pages via Actions (`.github/workflows/deploy.yml`). No backend for single-player.

**SPA routing note:** there is no client router yet. When one is added, use **hash routing** (or ship a `404.html` that is a copy of `index.html`) so deep links don't 404 on Pages.
