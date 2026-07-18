# Vision

## The pitch

WizardCards is a single-player roguelike deckbuilder inspired by Slay the Spire: build a deck, fight through encounters, get stronger, die, try again. Two things make it distinctive:

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

## Explicit non-goals (for now)

- Final card set, numbers/balance, combat rules, enemy AI, map/run structure.
- Art, audio, animation polish.
- The multiplayer *networking* implementation (we build the architecture that enables it, not the netcode itself).
- Accounts, persistence backends, monetization.

## Open questions (to refine later)

- How large/expressive should the card language get? (Conditions, triggers, targeting, keywords, scaling.)
- Class/character system? Relics/artifacts analog?
- Run structure: map, events, shops, bosses?
- Multiplayer mode: co-op vs. versus? Real-time vs. turn-based?

These are captured here so we don't lose them — they are **not** being decided yet.
