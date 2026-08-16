# The Battle Loop & Game View

How a self-contained match is played (the Phase-2 game loop) and how it's drawn.

## Setup → play → outcome

A match is `newBattle({ character, relicId, seed })` in `src/cards/match/battle.ts`:

1. **Decks.** Each combatant gets a shuffled 20-card deck (`buildDeck` samples the character's ~40-card pool). Playable characters today: **Cloud, Wizard, Crab, Writer** and **Old Lady**; the **Knight** is authored but has no art yet, so `content.ts` marks it `playable: false` and character select hides it. The opponent is a cloud-themed "Rival Cloud" with a curated attack deck.
2. **Relic.** The chosen relic's `onCombatStart` effects fire once (e.g. Old Shield → 5 shields), applied through the reducer.
3. **Opening hand.** Both sides draw 5, then discard 2 down to 3 — the enemy mulligans immediately (2 at random, via the seeded RNG, since its AI has no choice to make), and the game pauses in the `mulligan` phase for the player to pick which 2 to drop (`confirmMulligan`). Then turn 1 begins.
4. **Turns.** Each turn you start with base energy (1) plus Lightning-cloud energy, draw 1, and play cards while you can afford them. Cards cost 1 by default; energy cards let you play more. Two keywords change what a card costs: an **Add** card played inside a Blank window is free, and a **Burn** card pays **Craft** instead of energy — `energyCostAt` is the single answer, and the hand's cost badge shows it.
   - **Running out of cards refills your hand:** the moment a combatant's hand hits zero mid-battle, they draw `HAND_REFILL` (3; Brain Jar: 4 via `bonusRefillDraw`) new cards — playing your last card counts. The refill settles at **step boundaries** (`settleHandRefills` — after a card fully resolves, after end-of-turn discards, at the end of the start-of-turn cascade), never mid-card: a mid-card refill could reshuffle the played card out of the discard before its own pile-movement resolves, and would double-fill hands for empty-then-redraw cards (Refresh, Exoskeleton). It's symmetric (enemies refill too), and inert during setup/mulligan or when no cards remain anywhere.
4b. **Card choices.** When a *human's* effect selects with a genuine choice (more eligible things than the effect takes), the resolution **pauses**: `runOrPause` raises `SetPendingChoice`, `GameState.pending` holds the not-yet-applied remainder (`queued`, plain actions — so a paused game still serializes/replays), and the battle screen turns clicks into picks. Four kinds, one per selecting action: `discard` picks from the hand, `cloud` picks which clouds to remove (the design's "X clouds, your choice"), `minion` picks which minions to discard (Throw, Hurl), and `recover` picks from the discard pile via an overlay (Dry Out). (Burn used to be a fifth; since the content drop it spends Craft rather than cards, so there is nothing to pick.) Picks are card `uid`s for the hand/discard-pile kinds and plain slot indices for clouds/minions. `resolvePendingChoice(state, picks)` validates them (eligible; exactly `count`), re-issues the paused action carrying the picks (`uids`/`indices`), and resumes the queue — which may pause again on the next choice. The pause sits mid-card deliberately: Double Draw ("Draw 2. Discard 2.") must offer the post-draw hand. Three boundaries never pause: the AI (always the deterministic defaults — rightmost discard, newest-first clouds/minions, most-recent recovery), whole-pool effects (discard your hand, remove all clouds — no real choice), and selections fired *inside* the trigger cascade (a Molt free play's own discard auto-resolves — the cascade stays atomic). The end-of-turn Fog discard is interactive too; its pause suspends `EndTurn` itself, so the enemy turn starts only after the pick.

5. **The enemy plays the same game.** After your end-of-turn, the enemy draws and plays real cards from its own deck via `playFromHand`. Its AI is `aiPlayOne(state, actorId)`: gather every legal play (in hand + affordable), pick one **uniformly at random** via the in-state RNG, and play it at a random opponent — repeated until no legal play remains. The turn is decomposed into steps — `endPlayerPhase` → `beginEnemyTurn` → `enemyPlayOne` (one random card) × N → `beginPlayerTurn` — so the game view can pace them (see below); `endPlayerTurn` composes the same steps synchronously for tests/headless play. `beginEnemyTurn` runs the same start-of-turn cascade (`runTurnCascade`) as the player, so a card-playing Cloud opponent fires *its own* clouds and replays *its own* minions.
6. **Outcome.** After every damaging step the driver checks: player at 0 HP → `lost`, all enemies at 0 → `won` (set via `SetPhase`).

Everything is a pure function of `(seed, your moves)`, so a battle is deterministic and replayable (see `tests/cards/battle.test.ts`).

### Energy economy, and the turn-1 exception

`SetEnergy` resets energy to the base (1) at the start of a normal turn — *before* clouds add to it, so "start with over 3 energy" checks (Summer) see the post-Lightning total.

**Turn 1 runs no upkeep at all.** `runTurnCascade` treats "no energy reset requested" as the marker for the opening turn and skips both the reset *and* the Power decay, so a combat-start relic survives into the turn it was granted for — Calculator's 2 energy and Earring's 2 Power alike.

### The per-character resources

Six things sit on `Combatant` beside energy, each with its own lifetime:

| Resource | Lives | Spent by |
|-|-|-|
| **Block** | cleared at the start of your turn | damage |
| **Shield** | until it is used up | damage |
| **Poison** (Wizard) | until a Venom/Drink spends it (Consuming: half) | Venom, Drink |
| **Craft** (Writer) | **never resets** — it is a bank | Burn cards, as their cost |
| **Power** (Old Lady) | decays 1 per turn (Explosives stops it) | nothing — it *boosts* the first attack each turn |
| **Bravery** (Writer) | until Brain Storm zeroes it | nothing — it boosts the first block/shield each turn |

`Combatant.nextTurn` is the seventh: a flat record of resources a `Next turn, …` card promised, paid out and cleared by `ApplyNextTurn` in the start-of-turn cascade.

## The game view

`src/ui/game/BattleScreen.tsx` renders a `GameState` as the full-screen scene in `reference/screen mockups`:

- The **level art**, in two painted layers per the player's character: a full-bleed backdrop (`Level BG-<Name>.png`) with the platform the fight stands on drawn over it (`Levels-<Name>.png`), matching `reference/screen mockups`. `levelArt()` in `art.ts` resolves both; the old CSS gradient stays underneath as the fallback for a character whose level art is missing.
- Your hero + cloud/minion tokens bottom-left; the opponent top-right (its hero art mirrored to face you).
- A fanned hand of **card art** along the bottom; click a card to play it (or, during the mulligan, to mark it for discard).
- **Persistent icons.** A combatant's Persistent cards in play show as their drawn 32×32 status icons beside the HP bar (`persistentIconUrl`), falling back to the card's name where no icon is drawn.
- **Every number is a plain HTML element** — HP bars, energy pips, block/shield/poison chips, deck counts, card cost badges. Only heroes, clouds, minions, and card faces are art. This is a hard rule: art is for *pictures*, HTML for *values*.
- A **play animation** makes each card legible as it resolves (`src/ui/game/effects.ts` + `EffectsLayer.tsx`): the played card rises into a center **play area** enlarged, with a text bubble of its English rules; a **projectile per outgoing effect** flies from it to the right target (damage → a red comet at the opponent; clouds drift to the caster; self-buffs like shield/heal/poison pop in place); and on impact the new state applies (bars move) as a **floating number** pops at the target ("-4", "+3", "❄×2", or "blocked"). It's all driven by the `impactsFromEvents` mapping, which is the single place effect visuals are defined. `BattleScreen.animateAndApply` owns the timing (rise → fly → impact) and is shared by player, enemy, and Attract Mode; the engine/driver stay pure (tests apply the same plays instantly).
- A **combat log** (top-left panel) shows how each play resolved — a color-coded, titled block per card play / turn marker (e.g. "The Cloud plays Cyclone" → "+1 Storm cloud", "Rival Cloud plays Zap" → "0 damage → The Cloud (2 blocked)", "+1 energy"). It's built purely from the engine's `GameEvent` stream by `src/ui/game/combatLog.ts` (`describeEvent`/`describeEvents`), so it stays accurate for effects that leave no lasting state trace, and it's the same feed in single-player and Attract Mode. See the game-log requirement in `docs/atomic-actions.md`.

Art resolution and sprite-sheet metadata live in `src/ui/game/art.ts`; `<Sprite>` (`Sprite.tsx`) animates a horizontal sheet with a pure-CSS `steps()` scroll. The pre-battle character/relic select is `PlaySetup.tsx`, reached from the menu at `#/play`.

**Paced enemy turn.** When you end your turn, the game view drives the decomposed enemy steps on a watchable clock: it waits **3s** before the enemy starts, then plays one random card every **1s** until the enemy is out of legal plays, then hands control back. It's an `async` sequence in `BattleScreen.doEndTurn` that advances a local state through `beginEnemyTurn`/`enemyPlayOne`/`beginPlayerTurn` (`setState` per step, `setTimeout` between), guarded by a mounted-ref. Player input is disabled while the enemy acts (`enemyActing`). The timing lives only in the view — the driver stays pure — so tests run the same battle instantly.

**Attract Mode** (`#/attract`, the menu's "Attract Mode" button) is an AI-vs-AI demo — **The Wizard vs The Cloud** — that auto-plays and loops. `BattleScreen`'s `auto` prop switches on a conductor (a `useEffect` that runs once): it auto-opens the mulligan, then walks the phase machine, using the **same** `aiPlayOne` for *both* sides (the player side too), paced 3s per turn / 1s per card, and restarts with a fresh seed when a side wins. All human input is hidden. Because both sides are just `aiPlayOne` + the shared turn steps, an entire match is deterministic and testable headlessly (`tests/cards/battle.test.ts` runs one to completion). The opponent here is a *real* Cloud (its full pool), not the curated Rival Cloud — `newBattle`'s `enemyCharacter` option builds it.

## Known limitations (first playable)

These are deliberate cuts for the first playable build, not invariants:

- **Characters:** all six are authored. Cloud, Wizard and Crab have hero animations; the Writer and Old Lady fall back to a labelled box for the hero but have full card art. The **Knight has no art at all** and is hidden from character select.
- **Decks** draw from each character's *authored* pool (Cloud 33, Wizard 33, Crab 27, Writer 25, Old Lady 30, Knight 19), not the full 40 in `reference/design.md`, and exclude Persistent cards — so the persistent-owner is always the player.
- **Relics** only fire at combat start. The design's ongoing relics (Urn, Toy Boat, Fish Food, Whale, Hand, Thorn, Leaky Potion, and the whole Writer/Old Lady/Knight sets bar the combat-start ones) need relic *triggers* and are not modelled; `RELICS` in `content.ts` holds the ones that are. `RELIC_ART` names the relics with a drawn icon — the rest show a glyph.
- **Hand size** is unbounded. The design's "10 max, discard down to 10" is not implemented for any character; it shows up most with the Old Lady, whose Add cards pile up until a Blank turns over.
- **Single-player's enemy** is a fixed "Rival Cloud" with a curated attack/defense deck (no cloud/poison/minion cards), which keeps the player's reactive persistents correctly inert during the enemy's turn. Attract Mode already shows a *full* character opponent playing its own clouds/minions, so a richer single-player enemy is mostly a content choice now; enemy **persistents** are still unmodelled (`activePersistents` reads the player), so give AI decks no Persistent cards.
- **Targeting**: attacks auto-aim at the enemy hero, but if the defender has minions the attacker picks a target at random (AI) or by clicking (player) — a minion soaks the whole hit and is discarded (the Wizard's decoy). Multi-target/AoE selection is still future work.
- **Cloud cap is 3.** Creating clouds past the cap replaces existing ones: the player clicks which to drop (one at a time), the AI drops its oldest (`capClouds`). Enforced via the `RemoveCloudAt` action.
