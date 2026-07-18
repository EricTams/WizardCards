# Roadmap

Phased plan. **We are at the end of Phase 0.** Nothing past Phase 0 is designed yet — later phases are placeholders to be refined.

## Phase 0 — Foundation ✅ (this setup)

- [x] Repo, tooling (Vite + TS strict + Vitest + ESLint), scripts.
- [x] Documentation set + `CLAUDE.md` invariants.
- [x] Layer structure with lint-enforced dependency direction.
- [x] Walking skeleton: pure engine (state, seeded RNG, atomic actions, reducer), card DSL (tokenizer + parser + resolver), a few starter cards, and a live Card Lab.
- [x] Tests: reducer, determinism (incl. property test), tokenizer, data-driven per-card.
- [x] GitHub Pages deploy workflow.
- [x] Main menu → Card Lab navigation (hash routing); `launch.bat` launcher.
- [x] Card Lab card editor with `localStorage` persistence + diff-report export (see `docs/card-lab.md`).
- [x] Reusable `GameView` renderer + Card Lab "Play test" mode: configurable play area (add/remove targets, pick target, play card through the engine).
- [ ] First push to GitHub + enable Pages (manual: **Settings → Pages → Source: GitHub Actions**) and confirm the live URL renders the Card Lab.

## Phase 1 — Card language & engine depth

- Expand the DSL: targets, conditions, triggers, keywords, scaling (see `card-dsl.md`).
- Grow the atomic-action set and status/effect modeling on combatants.
- Intent layer + rules validation (`playCard` intent → validate → expand → apply).
- **Game log (combat log):** a chronological, human-readable record built from the reducer's `GameEvent` stream (not from state). Required in the game view and the Card Lab Play test. See the requirement in `docs/atomic-actions.md`.
- Richer Card Lab: AST pretty-print, error underlining in the text, multi-target/AoE testing, status effects in the play area.

## Phase 2 — Game loop

- Encounters, enemies + simple intent-based AI, energy/turn structure, win/lose.
- Run structure: map, rewards, deck evolution.
- Real UI for the game view (beside the Card Lab).

## Phase 3 — Content & balance

- A full starter card set authored in English, each with edge-case fixtures.
- Coverage thresholds enabled.
- Balancing tools (the Card Lab as a design aid).

## Phase 4 — Multiplayer (if pursued)

- Authoritative reducer on a server; clients send intents, receive atomic actions.
- Snapshots + reconciliation using deterministic RNG.
- Decide mode: co-op vs. versus, turn-based vs. real-time.

See `docs/vision.md` for the open questions feeding these phases.
