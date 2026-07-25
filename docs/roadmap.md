# Roadmap

Phased plan. **We are at the end of Phase 0.** The *game design* now exists — see `reference/design.md` (the "Weather & Wanderers" rulebook: 5 characters, their card lists, relics, setup rules). The phases below are the implementation path from today's walking skeleton toward that design; the exact scope of each is still being refined.

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
  - ✅ **Flat-effect grammar** for Cloud & Wizard: `heal`, `poison`, `create/remove clouds`, `discard minion`, `gain energy/shield/power/bravery`, the `venom`/`drink`/`minion` keywords, and comma-separated statements. A batch of both characters' cards is authored (`src/cards/definitions/cloud.ts`, `wizard.ts`).
  - ✅ **Trigger grammar:** persistents are authored in English — `When[ever]/At <event>[, if <condition>], <effects>` + cloud modifiers + `to all/random opponent` targeting — and compiled to behavior (`compilePersistent`). `CardScript` now splits into `effects`/`triggers`/`modifiers`.
  - ✅ **Scaling:** `deal damage equal to your <resource>` and `deal N damage for each [unique] cloud/minion`, resolved in the reducer (`DealDamageScaled` + `metricValue`). Electrocute, Spin, Crystal Ball, Hurl.
  - ⏳ Still open: scaling on non-`deal` effects, more trigger events/conditions, and on-play AoE targeting.
- ✅ **Trigger & turn system** (`src/cards/match`, `docs/triggers.md`): per-turn cloud firing, minion replay, and reactive/conditional Persistents (Winter/Fall/Spring/Summer/Static, Rot Away/Consuming), resolved as a deterministic cascade above the atomic engine. `playCard`/`startTurn`/`endTurn`.
- Grow the atomic-action set and status/effect modeling on combatants.
  - ✅ `Combatant` now carries `block`/`shield`/`energy`/`poison`/`power`/`bravery`/`clouds`/`minions`/`persistents`; actions added for each (see `docs/atomic-actions.md`). Damage soaks block → shield → hp.
- ✅ **Per-card tests:** declarative, serializable `CardTest` specs + a pure `runCardTest` runner, run by Vitest and authorable in the Card Lab (`docs/card-testing.md`).
- Intent layer + rules validation (`playCard` intent → validate → expand → apply). *(`playCard` exists in `match`; formal move validation still to come.)*
- **Game log (combat log):** a chronological, human-readable record built from the reducer's `GameEvent` stream (not from state). Required in the game view and the Card Lab Play test. See the requirement in `docs/atomic-actions.md`.
- Richer Card Lab: ✅ CardTest authoring UI + turn controls + resource chips; ⏳ AST pretty-print, error underlining in the text, multi-target/AoE testing.

## Phase 2 — Game loop (a single self-contained battle) 🟡 first playable

The one-battle loop the design describes (`reference/design.md` → "Game Setup & Core Rules") is now playable end to end — pick a character, keep 1 of 3 relics, draw 5 / discard 2, and fight the opponent to 0 HP. See `docs/battle.md`.

- ✅ **Per-combatant decks:** card piles (`drawPile`/`hand`/`discardPile`/`exhaustPile`) moved from `GameState` onto `Combatant`, so the enemy draws and plays cards through the *same* reducer as the player — the symmetric, multiplayer-ready shape.
- ✅ **Battle driver** (`src/cards/match/battle.ts`): setup (deck build, relic combat-start, opening hand), mulligan, `playFromHand` (energy validate/spend → move to discard → resolve with triggers), `endPlayerTurn` (player end → **enemy's full card-playing turn** → next player turn), and win/lose via `SetPhase`.
- ✅ **Energy economy & turn structure:** base 1 energy/turn (`SetEnergy` reset) + Lightning clouds; draw 1 per turn; reshuffle on deckout.
- ✅ **Block** (temporary) vs. **Shield** (persistent) — already two distinct resources on `Combatant`.
- ✅ **Game view** (`src/ui/game/BattleScreen.tsx`): the full battle screen from the mockups, using the hand-drawn art for cards/heroes/clouds and HTML for every numeric value; character/relic select (`PlaySetup.tsx`) at `#/play`.
- ✅ **The Crab** (`src/cards/definitions/crab.ts`): 21 cards + Crab Trap and Exoskeleton, playable from character select on the `beach` theme, with the **Claw** keyword (`src/cards/match/claw.ts`), `discard N cards`, scaling off `cardsDiscardedThisTurn`, and the Seashell relic (opening hand of 6 instead of 5).
- ⏳ Still open: the rest of the ~40-card pools (what remains needs deck manipulation, choosing a card from hand, replaying a card, or granting Claw) + Persistent cards in decks, a richer/varied enemy model (enemy persistents & clouds), multi-target/AoE selection, the Old Lady and the Writer, and formal move-intent validation. The **game log** (below) is also still to come in the game view.

Several design ambiguities that gated this phase are now decided (energy economy, enemy model = same card system, no turn limit) — see `vision.md`.

## Phase 3 — Content & balance

- Author the 5 character card sets from `reference/design.md` in English — Attacks / Skills / Persistents — each with edge-case fixtures, plus the relics.
- The per-character **status/keyword systems** these cards need: Clouds (Lightning/Snow/Fog/Storm), Poison/Venom/Drink & Minions, Claw/discard, Blank/Add & Power, Unplayable/Burn/Find & Bravery, and Persistent (ongoing) cards.
- Coverage thresholds enabled.
- Balancing tools (the Card Lab as a design aid).

## Phase 4 — Multiplayer (if pursued)

- Authoritative reducer on a server; clients send intents, receive atomic actions.
- Snapshots + reconciliation using deterministic RNG.
- Decide mode: co-op vs. versus, turn-based vs. real-time.

See `docs/vision.md` for the open questions feeding these phases.
