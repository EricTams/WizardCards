# The Card Lab

An in-game tool (reachable from the main menu at `#/cardlab`) for browsing, editing, and testing cards, and for producing a **diff report** we can use to patch the real card list.

Lives in `src/ui/cardlab/`. It consumes only the `engine` and `cards` public APIs — it owns no game logic.

The Lab has two modes (a tab in the header):

- **Edit** — author cards.
- **Play test** — test a card against a configurable play area, rendered with the real game view.

## What it does

- **Browse** every card (the effective list = baseline registry + your local edits).
- **Edit** a card's name, cost, and English text, or **add**/**delete** cards.
- **Compile preview** (Edit mode) for the selected card: tokens → parse tree (see the DSL pipeline in `docs/card-dsl.md`).
- **Play test** (see below): add/remove targets, pick which one the card hits, and apply the card's effects through the engine reducer.
- **Persist** all edits to `localStorage` so they survive reloads.
- **Export** a diff report (JSON download) capturing everything you changed.

## Play test / the play area

Play test mode renders the sandbox `GameState` with **`GameView`** (`src/ui/game/GameView.tsx`) — the same reusable renderer the real game will use, which reads state and never mutates it. In the Lab the enemy row is interactive:

- **+ Add target** / **× remove** — configure the encounter.
- **Click a target** to aim at it. `Deal` hits the selected target; `Gain` applies to the player.
- **▶ Play card** compiles the card under test, binds its producers to `{ self: player, target }`, and applies the resulting atomic actions via `applyAll` — the exact engine path a real move takes. **↺ Reset arena** restores a fresh scenario.

Arena setup helpers are pure and unit-tested (`src/ui/cardlab/arena.ts`, `tests/ui/arena.test.ts`): building/adding/removing targets constructs plain state directly (scenario setup ≠ in-game moves), while *playing* a card always goes through the reducer.

## Persistence model

Edits are stored as a **`CardOverrides` overlay** on top of the baseline `ALL_CARDS` registry — not as a rewrite of the card files.

- Pure overlay logic (`applyOverrides`, types) lives in `src/cards/overrides.ts` — testable, no browser APIs.
- The `localStorage` read/write lives in `src/ui/cardlab/storage.ts` (key `wizardcards.cardOverrides.v1`). It degrades gracefully to the empty overlay on corrupt data or private-mode failures.

`CardOverrides = { version, edited: Record<id, CardDef>, removed: id[] }`. The effective list is baseline with `edited` applied/appended and `removed` dropped.

> The overlay currently scopes to the Card Lab (editing/testing/export). It does not yet change gameplay — there is no gameplay yet. Wiring the effective list into the game is a later step.

## The diff report (author ⇄ user workflow)

The whole point: a user edits cards locally and sends us a report; we patch the source.

1. **User:** edits cards in the Card Lab → clicks **Export diff report** → gets `wizardcards-card-diff-<timestamp>.json`.
2. **User:** sends us that file.
3. **Us:** read it and apply the changes to `src/cards/definitions/*` and `registry.ts`.

Report shape (`src/cards/diff.ts`, `buildReport`):

```jsonc
{
  "kind": "wizardcards.card-diff",
  "version": 1,
  "generatedAt": "2026-07-18T…Z",
  "summary": { "added": 1, "modified": 2, "removed": 0 },
  "diff": {
    "added":    [ { "id": "custom-…", "name": "…", "cost": 1, "text": "…" } ],
    "modified": [ { "id": "strike", "changedFields": ["text"],
                    "before": { …CardDef… }, "after": { …CardDef… } } ],
    "removed":  [ { …CardDef… } ]
  }
}
```

### Applying a report (for maintainers)

For each entry in `diff`:

- **modified** — update the matching `CardDef` in `src/cards/definitions/` to the `after` values.
- **added** — add a new `CardDef` in `definitions/` and register it in `registry.ts` (`ALL_CARDS`). Consider a stable id rather than the generated `custom-<timestamp>`.
- **removed** — delete the `CardDef` and its registry entry.

Then run `npm test` — the data-driven suite in `tests/cards/registry.test.ts` covers the new state automatically.

> The pure `diffCards`/`buildReport`/`applyOverrides` functions are unit-tested in `tests/cards/`, and the persistence layer in `tests/ui/storage.test.ts`. A future maintainer tool could apply a report to the source automatically; today it's a manual patch.
