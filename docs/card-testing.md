# Testing cards

Every card should have at least one **CardTest**: a small, serializable description of a situation, the card to play, and the expected result. Because a CardTest is plain JSON data, the same spec is used two ways:

- the **Vitest suite** runs the built-in specs (`tests/cards/card-tests.test.ts` over `src/cards/card-tests.ts`), and
- the **Card Lab** (soon) lets an author build one in the UI, run it against the live engine, and export it alongside the card diff report.

The runner is pure — no DOM, no I/O — so it works identically in Node tests and in the browser.

## The shape (`src/cards/testing.ts`)

```ts
interface CardTest {
  name: string;
  cardId: CardId;         // which registered card to play
  setup: CardTestSetup;   // the starting situation
  expect: CardTestExpect; // what must be true afterward
}
```

- **`setup`** — optional overrides on the sandbox: `player` / `target` combatant fields (`hp`, `block`, `shield`, `energy`, `poison`, `power`, `bravery`, `clouds`, `minions`), plus `hand` / `drawPile` / `discardPile` and a `seed`. Anything you don't set uses a full-health default.
- **`expect`** — only the fields you name are checked, so a test can assert just "target hp is 24" and ignore the rest. Combatant expectations include the numeric resources and the **counts** `clouds` and `minions`; you can also assert `handSize`, `drawPileSize`, `discardPileSize`.

## How the runner works (`runCardTest`)

1. `compile(card.text)` — a compile failure is itself a test failure (`result.error`).
2. `buildTestState(setup)` — a sandbox `GameState` with the player as `player` and one enemy as `target-0`.
3. Produce each effect's action with `ctx = { self: player, target: target-0, sourceCard: card.id }` and fold them through the real `apply` reducer.
4. Diff actual vs. `expect`, returning `{ ok, failures, error? }` where each failure is `{ field, expected, actual }`.

## Adding a test

Add an entry to `CARD_TESTS` in `src/cards/card-tests.ts`:

```ts
{
  name: 'Hostile: Venom spends poison as damage, then Drink finds none left',
  cardId: HOSTILE.id,
  setup: { player: { poison: 4 }, target: { hp: 30, maxHp: 30 } },
  expect: { target: { hp: 26 }, player: { poison: 0, block: 0 } },
}
```

`npm test` runs it automatically. Keep `expect` terse — assert only the fields the card actually changes; this keeps tests robust as the combatant model grows.

## Relationship to the registry suite

`tests/cards/registry.test.ts` is the coverage floor: **every** registered card must compile and its actions must apply without throwing. CardTests are the behavioural layer on top — they assert a card does the *right* thing, not merely that it runs. Prefer a CardTest over a one-off test file for per-card expectations.
