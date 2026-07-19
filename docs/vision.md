# Vision

## The pitch

**Weather & Wanderers** ("WizardCards" is the repo/codebase name) is a single-player deckbuilding card battler. A match is a **self-contained battle**: choose 1 of 5 characters (Cloud, Crab, Wizard, Old Lady, Writer), play a 20-card deck drawn from that character's ~40-card pool, pick 1 of 3 relics, and fight one opponent over roughly 10 turns. There is no meta-progression — think of it as a printable card game brought to life. Two things make it distinctive:

1. **Cards are written in English.** A card's rules text *is* its implementation. A small domain-specific language compiles text like `Deal 6 damage. Gain 5 block.` into executable game effects. There is no separate hand-coded behavior per card.
2. **A Card Lab is a first-class, in-game tool.** You type a card and immediately see how the engine reads it — tokens, parse tree, resolved effects, and the effect applied to a sandbox game state. This is both a design tool and a way to make the game's rules legible to players.

## Why these constraints

- **Authoring speed & correctness.** English cards + a data-driven test suite mean new content is cheap to write and impossible to ship untested.
- **Multiplayer-readiness from day one.** Even though v1 is single-player, we separate *game state* from *display* completely and model every move as an atomic, serializable, deterministic action. Retrofitting this later is expensive; designing for it now is nearly free (see `atomic-actions.md`).
- **Static, zero-backend hosting.** Ships to GitHub Pages. No server required for single-player.

## Principles

- **The engine is pure.** Given the same inputs it produces the same outputs. No time, no randomness outside the seeded RNG, no I/O.
- **Data over code.** Cards, encounters, and content are data; the engine interprets them.
- **Legibility.** If the game can compile a card, the Card Lab can explain it. Errors point at the exact text.

## The design

The game design — the 5 characters and their signature mechanics, the full card lists (Attacks / Skills / Persistents), the relics, and the setup rules (20 HP, draw 5 / discard 2 to open — so you begin turn 1 with 3 cards — draw 1 per turn, hand max 10) — lives in **`reference/design.md`**. That document is the source of truth for *what the game is*; the `docs/` here describe *how it's built* and how far the implementation has come (see `roadmap.md`).

## Explicit non-goals (for now)

- Numbers/balance tuning (the card list exists in `reference/design.md`, but is unbalanced and will change).
- Art, audio, animation polish. (Character/card art has started under `assets/art/`, currently Cloud + Wizard.)
- The multiplayer *networking* implementation (we build the architecture that enables it, not the netcode itself).
- Accounts, persistence backends, monetization.

## Open questions (to refine later)

**Resolved by `reference/design.md`:** the character system (5 defined characters), the relics analog (general + per-character relics), and the run structure (self-contained battles, no map/run meta-layer).

Still open:

- How large/expressive should the card language get? (Conditions, triggers, targeting, keywords, scaling — the design implies a *lot*; see `card-dsl.md`.)
- Multiplayer mode: co-op vs. versus? Real-time vs. turn-based? (Opponents already play by the same rules as the player, so a versus mode is a natural fit.)

### Rules clarifications (decided)

Reconciling `reference/design.md` against the engine settled these:

- **Energy** — you start each turn with **1 energy** and cards **cost 1 by default**, so a baseline turn plays one card; energy-granting cards and effects let you play more.
- **Enemies play like players** — opponents are characters running the same card system, not scripted intents. This is what makes a future versus multiplayer mode straightforward.
- **No turn limit** — "~10 turns" is just a typical match length, not a cap. Running out of cards reshuffles the discard into the draw pile (as the engine already does, and per the *Brain in a Jar* relic), so there's no deckout loss. You win by taking the opponent to 0 HP.
- **Cloud cap is 3** — creating clouds past 3 replaces existing ones (the player chooses which to drop one at a time; the AI auto-drops its oldest). "Increase Max Clouds" cards would raise the cap once wired up.
- **Relic offer** — the 3 relics you choose from are drawn from **both** the general pool and your character's pool.

Done since these were written: **Block** (temporary) and **Shield** (persistent) are now two separate resources on `Combatant` (damage soaks block → shield → hp), and the "opponents play like players" decision is realized — the enemy draws and plays real cards through the same reducer in the battle loop (`docs/battle.md`).

These are captured here so we don't lose them.
