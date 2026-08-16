# Triggers & the turn loop

Cards don't just do their own effects — play cascades. Creating a cloud can make a persistent deal damage, which makes another persistent add poison; the start of a turn fires every cloud and replays every minion. This document describes the layer that resolves that cascade.

## Why it lives in `cards`, not `engine`

The engine reducer is deliberately **atomic and trigger-free**: `apply(state, action)` is one action → one mutation, exhaustive and pure (see `docs/atomic-actions.md`). It has no knowledge of clouds' *meanings* or of card text.

But resolving triggers needs both:
- the **reducer** (to apply the follow-up actions), and
- the **card DSL** (a minion *replays its compiled card text*; authored persistents will too).

The only layer that can import both is `cards` (`ui → cards → engine → shared`). So the orchestration lives in **`src/cards/match/`**, above the engine, below the UI. The engine stays a clean, replayable core.

## Determinism is preserved

Triggers are a **pure function of state + the event that fired them**. All randomness still flows through engine actions (`state.rng`) — e.g. a Storm cloud's "damage a random enemy" is the `DealDamageToRandomEnemy` atomic action, which advances `state.rng` inside the reducer. Because triggers derive from state, they need not be recorded: **replaying the primary actions reproduces every triggered effect**, so the action log stays the source of truth.

## The two kinds of trigger

### Reactive — "whenever X happens"
After each atomic action, the orchestrator looks at the `GameEvent`s it emitted and asks every active persistent whether it reacts. Reactions are themselves actions, applied in turn, whose events may trigger more — a queue drained to a fixpoint (with a large safety cap against pathological loops).

```
applyWithTriggers(state, action):
  base = apply(state, action)                 // engine
  queue = base.events
  while queue not empty:
    event = queue.shift()
    for followup in reactiveTriggers(state, event):
      r = apply(state, followup); queue.push(r.events)
```

Some events carry extra data precisely so triggers can key off them: `DamageDealt.unblocked` (Rot Away — "unblocked damage") and `CloudsRemoved.removed` (Static — "a Lightning cloud is removed").

### Molt — the card itself is the trigger

Persistents react from the play area and minions replay from the board, but the Crab's **Molt** reacts *as the card leaves the hand*: "whenever this card is discarded, it plays for free". So it can't be a persistent — the card isn't in play — and it hangs off the `CardsDiscarded` event instead, in `src/cards/match/molt.ts`. `reactiveTriggers` returns the union of the two sources, and the free plays join the same cascade as everything else, so a discarded Molt card that itself discards keeps the chain going (bounded by the same `TRIGGER_CAP`).

"For free" is literal: nothing in that path touches energy, because the card was never played from a hand.

**Not every trip to the discard pile is a discard.** `CardsDiscarded` carries a `reason`:

| `reason`   | When                                              | Molt fires? |
|------------|---------------------------------------------------|-------------|
| `discard`  | "Discard 2 cards", the end-of-turn Fog penalty    | **yes**     |
| `play`     | a card moving to the pile as it is played         | no          |
| `setup`    | the opening mulligan, before the battle begins    | no          |

The distinction is load-bearing rather than cosmetic. Playing a card moves it to the discard pile through the very same event, so firing on `play` would play every Molt card **twice**; and the mulligan is a setup step, where a Molt card would otherwise resolve before turn 1. The same rule governs the `cardsDiscardedThisTurn` counter, which only `discard` increments.

### Markings — the copy carries the trigger

The Knight's **Markings** are the other per-copy trigger, and the simplest: they aren't compiled from text at all. A marked copy carries `{ sharp: 2 }`, and `markEffects` (`src/cards/match/marks.ts`) turns that into actions as the card is played, *before* the card's own text. Each kind maps to one fixed effect scaled by its value — Sharp → damage a random enemy, Sturdy → draw, Flaming → energy, Safe → heal. The copy is in the discard pile by then, so its markings are spent with it; nothing has to erase them.

Each marking also raises a `MarkedCardPlayed` bookkeeping event (via `NoteMarkedCardPlayed`), which is what "when you play a card Marked with Sharp" persistents (Engrave, Etching, Woodworking) key off — the marking's effect alone would be invisible to them.

### Burn — a cost, not a cascade

The Writer's **Burn** used to work like Molt: it spent Unplayable cards from your hand and played their effects. Since the 2026-08-15 content drop it is simply a **cost in Craft** — `BurnCraft` moves the number out of `Combatant.craft` and raises `CraftBurned`, which "when you Burn, …" persistents (Ink, Wordsmith) fire on, once per Burn rather than once per point. `canPlayAt` refuses a Burn card unless that much Craft is banked, and the AI's `validPlays` uses the same gate so it can never pick a play the engine then rejects. A Burn card costs **no energy** (`energyCostAt`).

### Fading and the Add window — hand state, resolved at the edges

Two more per-copy keywords act outside the event cascade, at fixed points in the turn:

- **Fading** (the Writer): the end-of-turn cascade runs `DiscardFading` before the Fog penalty, discarding every Fading copy still in hand. It is a *real* discard, so it counts and sets off Molt.
- **Blank / Add** (the Old Lady): `playFromHand` reads the played copy's keywords and opens, keeps, or shuts the **Add window** (`Combatant.addWindow`) around it — a Blank opens it, an Add keeps it open and bumps `cardsAdded`, anything else shuts it. `canPlayAt` refuses an Add card outside a window, and `energyCostAt` makes it free inside one. `ClearTurnCounters` closes the window each turn, so it can never survive into the next.

**Power decays in the cascade, not the reducer.** "Power decreases by 1 at the start of your turn" is a game rule, so `runTurnCascade` applies it — right after the energy reset and before any of this turn's Power-granting cards land. Explosives suppresses it via the `suppressPowerDecay` modifier. Turn 1 runs *no* upkeep (no energy reset, no decay), so a combat-start relic survives into the turn it was granted for.

**One action can be amended by the play area.** Consuming ("lose only half of your Poison when you use Venom or Drink") changes how a single atomic action behaves, and the reducer must not know what persistents exist. `applyWithTriggers` therefore runs an `amend` step: it stamps `keepHalf` onto a Venom/Drink before handing it to the reducer. Doing it there rather than in the resolver covers every path a Venom can arrive by — a card play, a Molt free play, a minion replay.

**Minion replay is announced.** Replaying a minion is orchestrated by the cards layer, not by an action, so it would otherwise be invisible to triggers. `runTurnCascade` runs a `NoteMinionReplayed` bookkeeping action before each pass, raising a `MinionReplayed` event that "when a minion is replayed" (Juggle) keys off — including the extra passes Protect the Drinks adds. `NoteCardPlayed` does the same job for the per-turn cards-played count.

### Phase — start / end of turn
`startTurn` sequences: advance the turn → clear temporary block and the per-turn counters → reset energy to base → **decay Power** by 1 → pay out anything a `Next turn, …` card promised (`ApplyNextTurn`) → fire each **cloud** (Lightning→energy, Snow→heal, Storm→damage a random enemy, Fog→draw) → run start-of-turn persistents (Summer, Fletching) → **replay each minion** (its compiled text minus re-summoning itself) → draw. `endTurn` runs end-of-turn persistents, discards **Fading** cards, makes Fog clouds force a discard (unless Fall), and ends the turn. Each step resolves its own reactive cascade before the next.

## Persistents — authored in English

Persistents are **ordinary cards, authored in English** (`src/cards/definitions/cloud-persistents.ts`, `wizard-persistents.ts`) and registered in `ALL_CARDS` like everything else. `compilePersistent(text)` (`src/cards/match/compile-persistent.ts`) parses the trigger grammar (`docs/card-dsl.md`) into the hooks the orchestrator consults: `onEvent` (reactive), `onStartTurn`/`onEndTurn` (phase), and the modifiers `snowHealBonus` (Winter) / `suppressFogDiscard` (Fall). Compilation is memoized by card id since text is static.

Modeled today: **Winter, Fall, Spring, Summer, Static, Wild Wind, Windmill** (Cloud); **Rot Away, Consuming, Protect the Drinks, Juggle** (Wizard); **Crab Trap, Exoskeleton, Decapod, Eyestalks, Prawn, Decorator** (Crab); **Ink, Wordsmith, Whiteboard** (Writer); **Sharpen, Crossword, Explosives, Fletching, Revenge** (Old Lady); and **Engrave, Etching, Woodworking** (Knight). Because a persistent's statements are all triggers/modifiers, `compile()` yields **zero on-play actions** — playing/registering one does nothing until it's in the play area. `PERSISTENT_CARDS` is the subset of the registry that behaves this way.

To add a persistent, write its English text as a card and it just works — no code, provided the trigger grammar covers its wording. Behavior that the grammar can't yet express (e.g. Wild Wind's cloud churn, "replayed N extra times") is the remaining gap, not the persistents themselves.

## Using it

- **Play a card with triggers:** `playCard(state, card, ctx)` → `{ state, events }`.
- **Advance turns:** `startTurn(state, { draw })` / `endTurn(state)`.
- **Put a persistent in play:** the `AddPersistent` atomic action (the Card Lab's "Add a persistent" dropdown), or set `player.persistents` in a `CardTest` setup.

The **Card Lab Play test** routes card play and the Start/End-turn buttons through this module, and the game view shows resource/cloud/minion/persistent chips, so you can watch a cascade happen.

## Not yet built

Trigger events for "when you play a Fading/Burn card", "when you draw an additional card", and "when you create a card" — the remaining gap behind Shake Spear, Direct, Paper Trail, Scribe, Cannonball and Time Heals all Wounds. Riders that arm a *future* play ("your next card is played twice", "when you play a card this turn, …") need a new kind of pending state and are the other big hole. **Relic triggers** — relics can only fire at combat start today, so the design's ongoing relics (Urn, Toy Boat, Thorn, Hand, Quilt, …) are unmodelled.
