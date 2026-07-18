# CLAUDE.md — WizardCards

Guidance for AI agents (and humans) working in this repo. Read this before making changes. We work **documentation-first**: when you change how something works, update the relevant doc in `docs/` in the same change.

## What this is

A TypeScript roguelike deckbuilder (Slay the Spire-ish), single-player first, **designed for** eventual multiplayer. Two signature features: cards authored in **English** (a small DSL compiles card text into game effects) and an in-game **Card Lab** that shows a card compiling in real time. Deploys as a static site to GitHub Pages.

## Non-negotiable invariants

These exist so the game stays testable, replayable, and multiplayer-ready. Do not violate them; if you think you must, update the docs and flag it.

1. **Layer dependency direction is one-way:** `ui → cards → engine → shared`. A layer may only import from layers to its right. `engine` importing `@cards`/`@ui`, or `cards` importing `@ui`, is a **lint error** (see `eslint.config.js`). The engine has zero DOM/React/card-text knowledge.
2. **`GameState` is plain, JSON-serializable data.** No class instances, functions, `Date`, `Map`, or `Set` in the state tree. `JSON.parse(JSON.stringify(state))` must equal `state`. This is what makes snapshots, saves, and netcode free.
3. **All state changes go through atomic actions and the reducer.** `apply(state, action) => { state, events }` is pure, total (exhaustive switch), and deterministic. Nothing mutates state in place. The UI never writes state — it renders `state` and reacts to `events`.
4. **All randomness flows through the in-state seeded RNG** (`state.rng`), never `Math.random`. Same seed + same action sequence ⇒ identical state. See `src/engine/rng`.

## Layout

```
src/
  shared/   ids, Result/Diagnostic types, branded types. Imports nothing.
  engine/   pure core: state, actions (atomic), reducers, rng. Public API in engine/index.ts
  cards/    the English DSL (dsl/: tokenizer→parser→ast→resolver), card definitions, registry. Public API in cards/index.ts
  ui/       React. The Card Lab + (later) the game view. Imports engine/cards public APIs only.
tests/      engine/ cards/ dsl/ — mirrors src; the card suite is data-driven over the registry.
docs/       vision, architecture, card-dsl, atomic-actions, testing-strategy, roadmap, glossary, adr/
```

Import across layers via the path aliases `@shared/*`, `@engine/*`, `@cards/*`, `@ui/*` (defined in `tsconfig.json` and `vite.config.ts`). Prefer importing from a layer's `index.ts` public surface.

## How to add a card

1. Add a `CardDef` (id, name, cost, English `text`) in `src/cards/definitions/`.
2. Register it in `src/cards/registry.ts` (`ALL_CARDS`).
3. `npm test` — the data-driven suite automatically checks it compiles and applies. Add specific expectation fixtures for edge cases.

If the card needs a verb/noun the DSL doesn't know yet, extend `dsl/parser.ts` (grammar) and `dsl/resolver.ts` (verb → atomic-action producer), and document it in `docs/card-dsl.md`.

## Applying a diff report from a user

Users edit cards in the **Card Lab** (`#/cardlab`, reachable from the main menu). Edits persist to `localStorage` as a `CardOverrides` overlay and can be exported as a JSON **diff report**. To patch the real card list from a report, follow `docs/card-lab.md` → "Applying a report": update/add/remove `CardDef`s in `src/cards/definitions/` + `registry.ts`, then `npm test`. Pure logic: `src/cards/overrides.ts`, `src/cards/diff.ts`.

## Scripts

- `launch.bat` — double-click launcher: installs deps if needed, starts the dev server, opens the game in the browser
- `npm run dev` — Vite dev server (Card Lab with HMR)
- `npm run build` — typecheck + static build to `dist/`
- `npm run preview` — serve the built site (under the `/WizardCards/` base)
- `npm test` / `npm run test:watch` / `npm run test:coverage`
- `npm run lint` — ESLint incl. the layer-boundary rule
- `npm run typecheck` — `tsc --noEmit` (strict)

Before finishing a change: `npm run typecheck && npm run lint && npm test` should all pass.

## Environment notes

Windows / PowerShell primary shell. Node 22+. Create files with the editor tools, not shell heredocs.
