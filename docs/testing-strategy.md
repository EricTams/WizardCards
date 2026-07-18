# Testing Strategy

Goal: **every card is tested, including edge cases**, and the engine's determinism/purity guarantees are verified continuously. Runner: **Vitest**; property testing: **fast-check**.

## Layout

Tests live in `tests/` mirroring `src/` (`tests/engine`, `tests/cards`, `tests/dsl`). Co-located `*.test.ts` next to source is also allowed (both globs are configured in `vite.config.ts`). Coverage is collected on `src/engine/**` and `src/cards/**` — the correctness-critical layers.

## The layers of testing

1. **Engine reducer tests** (`tests/engine/reducer.test.ts`) — each atomic action does the right thing (block absorbs damage, hp floors at 0, draw reshuffles the discard when empty) and never mutates its input.
2. **Determinism & purity** (`tests/engine/determinism.test.ts`):
   - Same seed + same action sequence ⇒ identical state.
   - Different seeds shuffle differently (exercises the RNG path).
   - **Property test:** for any seed and any random action sequence, replaying twice yields identical state.
   - State round-trips through JSON losslessly (serializable invariant).
3. **DSL tests** (`tests/dsl/`) — tokenizer spans, parser diagnostics, resolver output. Snapshot tests are appropriate for AST/token shapes.
4. **Every-card tests** (`tests/cards/registry.test.ts`) — **data-driven over `ALL_CARDS`**: every registered card must compile, produce applicable actions, and leave state serializable. Adding a card to the registry automatically adds it to this suite. Card ids must be unique.

## Adding edge-case coverage for a card

Prefer declarative **CardTests** over bespoke test files: for a card, assert the exact resulting state after playing it against a known sandbox (e.g. Shine — Deal 6 — vs. a 30-hp dummy with 2 block and 1 shield leaves it at 27 hp / 0 block / 0 shield). These live as serializable specs in `src/cards/card-tests.ts`, run by `tests/cards/card-tests.test.ts`, and are authorable in the Card Lab — see `docs/card-testing.md`. As the DSL grows, add negative fixtures (malformed text → expected diagnostics with spans).

## Property-based testing (fast-check)

Use it wherever a rule should hold across *all* inputs, not just examples:
- Determinism across random action sequences (already present).
- Card invariants (e.g. "playing any card never produces non-serializable state", "damage never raises hp").
- RNG distribution/shuffle sanity as needed.

## Running

```bash
npm test              # one-shot
npm run test:watch    # TDD loop
npm run test:coverage # coverage report (text + html)
```

## CI

`.github/workflows/deploy.yml` runs `lint → typecheck → test → build` before any deploy, so `main` never publishes red. Add coverage thresholds (in `vite.config.ts`'s `test.coverage`) once the engine/cards stabilize.
