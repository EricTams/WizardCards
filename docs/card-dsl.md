# The Card English Processor (DSL)

A card's behavior is authored as English text and compiled into atomic-action producers. The pipeline is a chain of pure functions, each returning a `Result` with positional `Diagnostic`s so the Card Lab can point at exactly where something went wrong.

## Pipeline

```
raw English text
  → tokenize   (src/cards/dsl/tokenizer.ts)  words / numbers / punctuation, each with a source span
  → parse      (src/cards/dsl/parser.ts)     tokens → CardScript AST (+ diagnostics)
  → resolve    (src/cards/dsl/resolver.ts)   AST → ActionProducer[]
  → (at play)  producer(context) → atomic Action, applied by the engine reducer
```

`compile(text)` in `src/cards/index.ts` runs parse → resolve and is what the Card Lab and the card test suite call.

## Why *producers*, not actions

Resolving text can't always produce a final action: an effect like "deal damage" needs a **target** that only exists when the card is played. So the resolver returns `ActionProducer = (ctx: PlayContext) => Action`. At play time we bind `ctx = { self, target }` and get concrete atomic actions. This keeps the compiled form reusable and context-free.

## Current grammar

A card is a list of statements separated by sentence punctuation — **`.`, `,`, `;`, or `:`** (so `Deal 3 damage, Remove 1 cloud.` is two statements). Nouns are matched **plural-insensitively** (`card`/`cards`, `shield`/`shields`). Each statement is one of:

```
deal    <number> "damage"
gain    <number> RESOURCE          RESOURCE ∈ block | shield | energy | power | bravery
heal    <number> [noun]            trailing noun ("HP") is decorative
poison  <number>
draw    <number> ["card"]
create  <number> CLOUD "cloud"     CLOUD ∈ lightning | storm | snow | fog | random
fill    "all empty cloud slots"
double  "your clouds next turn"
remove  <number> ["random"] "cloud" | remove "all clouds"
increase "max clouds by" <number>
discard <number> ("minion" | "card") | discard ("your hand" | "all minions")
retain  "your poison"
"venom" | "drink" | "minion"       bare keyword effects (no number/noun)
```

| English                    | AST (`EffectNode`)                                  | Produces                                   |
|----------------------------|-----------------------------------------------------|--------------------------------------------|
| `Deal 6 damage.`           | `{ verb:'deal', amount:6, noun:'damage' }`          | `DealDamage(target, 6)`                    |
| `Gain 5 block.`            | `{ verb:'gain', amount:5, noun:'block' }`           | `GainBlock(self, 5)`                       |
| `Gain 4 shields.`          | `{ verb:'gain', amount:4, noun:'shield' }`          | `GainShield(self, 4)`                      |
| `Gain 1 energy.`           | `{ verb:'gain', amount:1, noun:'energy' }`          | `GainEnergy(self, 1)`                      |
| `Heal 3.`                  | `{ verb:'heal', amount:3 }`                         | `Heal(self, 3)`                            |
| `Poison 5.`                | `{ verb:'poison', amount:5 }`                       | `GainPoison(self, 5)`                      |
| `Draw 2 cards.`            | `{ verb:'draw', amount:2, noun:'cards' }`           | `DrawCards(2)`                             |
| `Create 2 storm clouds.`   | `{ verb:'create', amount:2, cloudType:'storm' }`    | `CreateClouds(self, 'storm', 2)`           |
| `Remove 1 cloud.`          | `{ verb:'remove', amount:1, noun:'cloud' }`         | `RemoveClouds(self, 1)`                    |
| `Remove all clouds.`       | `{ verb:'remove', noun:'allClouds' }`                | `RemoveAllClouds(self)`                    |
| `Create 1 random cloud.`   | `{ verb:'create', amount:1, noun:'randomClouds' }`   | `CreateRandomClouds(self, 1)`              |
| `Remove 1 random cloud.`   | `{ verb:'remove', amount:1, noun:'randomClouds' }`   | `RemoveRandomClouds(self, 1)`              |
| `Fill all empty cloud slots with random clouds.` | `{ verb:'fill', noun:'cloudSlots' }` | `FillCloudSlots(self, CLOUD_CAP)`   |
| `Increase max clouds by 1.`| `{ verb:'increase', amount:1, noun:'maxClouds' }`    | `IncreaseMaxClouds(self, 1)`               |
| `Discard 1 minion.`        | `{ verb:'discard', amount:1, noun:'minion' }`       | `DiscardMinion(self, 1)`                   |
| `Discard 2 cards.`         | `{ verb:'discard', amount:2, noun:'card' }`         | `DiscardCards(self, 2)`                    |
| `Discard your hand.`       | `{ verb:'discard', noun:'hand' }`                    | `DiscardHand(self)`                        |
| `Discard all minions.`     | `{ verb:'discard', noun:'allMinions' }`              | `DiscardAllMinions(self)`                  |
| `Retain your poison.`      | `{ verb:'retain', noun:'poison' }`                   | `SetVenomRetains(self, true)`              |
| `Venom.`                   | `{ verb:'venom' }`                                  | `Venom(self, target)`                      |
| `Drink.`                   | `{ verb:'drink' }`                                  | `Drink(self)`                              |
| `Minion.`                  | `{ verb:'minion' }`                                 | `SummonMinion(self, sourceCard)`           |

Multiple statements chain: `Deal 4 damage. Gain 2 block.` → two producers.

**Scaling handled at reduce time.** "Deal damage equal to your Poison" (Venom) and "gain block equal to your Poison" (Drink) don't need a play-time state peek: the `Venom`/`Drink` atomic actions read (and then zero) the caster's `poison` inside the reducer, keeping the compiled form context-free and the result deterministic.

**`PlayContext` now carries `sourceCard`** (the id of the card being played) in addition to `self`/`target`, so a `Minion.` effect can summon a copy of its own card.

Anything unrecognized becomes a `Diagnostic` (with a `[start, end)` span) instead of throwing.

## Triggers, conditions, targeting & modifiers

Parsing has two levels: text splits into **sentences** on `.`/`;`, and each sentence is a **trigger**, a **modifier**, or a comma-separated list of the effect statements above. So `CardScript` now has three lists: `effects` (immediate, on-play), `triggers` (ongoing), and `modifiers` (static rule changes). Persistent cards are all triggers/modifiers, so they compile to **zero on-play actions** — their behavior fires while in play, resolved by `src/cards/match` (see `docs/triggers.md`).

**Triggers** — `When`/`Whenever`/`At <event>[, if <condition>], <effect>[, <effect>…]`:

| English                                             | Trigger (AST)                                             |
|-----------------------------------------------------|----------------------------------------------------------|
| `Whenever you create a cloud, …`                    | `{ event: 'createCloud' }`                                |
| `Whenever a lightning cloud is removed, …`          | `{ event: 'removeCloud', cloudType: 'lightning' }`        |
| `Whenever you deal unblocked damage, …`             | `{ event: 'dealUnblockedDamage' }`                        |
| `When a minion is discarded, …`                     | `{ event: 'discardMinion' }`                              |
| `When a minion is replayed, …`                      | `{ event: 'minionReplayed' }`                             |
| `At the start of your turn, …`                      | `{ event: 'startTurn' }`                                  |
| `At the end of your turn, …`                        | `{ event: 'endTurn' }`                                    |

The when-phrase is matched by keywords, so wording is forgiving. A reactive trigger fires **once per unit** — per cloud created, per matching cloud removed, per minion discarded.

**Conditions** — an optional gate. `over N` / `more than N` are **strict** (`op: 'gt'`); `N or more` / `N or greater` are **inclusive** (`op: 'gte'`) — the `or` is what distinguishes them. E.g. `…, if you have over 3 energy, …` → `{ resource: 'energy', op: 'gt', amount: 3 }`, and `…, if you have 5 or more block, …` → `{ resource: 'block', op: 'gte', amount: 5 }`.

**Random clouds.** A `random` cloud type carries no `cloudType` — the reducer draws one through `state.rng`, so the same seed reproduces the same weather and the action log stays the source of truth. `CreateRandomClouds` emits one `CloudsCreated` per cloud rather than one batched event, since the types differ and "whenever you create a cloud" fires per cloud. `FillCloudSlots` is handed `CLOUD_CAP` as its `baseCap` because the limit is a cards-layer rule; the engine adds the combatant's own bonus.

**Retaining Poison.** Venom normally zeroes the caster's Poison. `Retain your poison.` sets `Combatant.venomRetains`, and the *next* Venom keeps its X-value instead of spending it, clearing the flag either way — so it arms exactly one Venom, whether that is the next statement (Sticky Poison) or several cards later (Sacrifice).

**Duration effects.** `Double your clouds next turn.` (Solar Power) sets `Combatant.cloudsPlayTwice`; the start-of-turn cascade fires `cloudEffects` a second time and then clears the flag, so it lasts exactly one turn. The flag is read *before* the first firing, since the cloud actions rewrite the combatant.

**Cloud cap.** `Increase max clouds by N` raises only the *bonus* (`Combatant.bonusMaxClouds`); the base limit is `CLOUD_CAP` in the cards layer, since the engine holds no game rules. Read the effective limit with `cloudCapFor(combatant)` — using the bare constant anywhere the cap is enforced or displayed makes a widened cap silently do nothing.

**Qualified counts beat bare ones.** In `countMetric`, "minion in your discard pile" and "card discarded this turn" are narrower readings of words that also match a bare count. They are tested *first* — testing `minions` before `minions + discard` would always win and silently count the board instead of the graveyard.

**Two resolvers, one AST.** On-play effects go through `dsl/resolver.ts`; effects *inside a trigger* go through `resolveTriggerEffect` in `match/compile-persistent.ts`, which resolves with state in hand (so scaling is computed there). A verb that varies its action by noun has to be taught to **both** — `discard` needs its minion/card/hand split in each, or a trigger silently does the wrong one.

**Targeting** — a trailing `to all opponents` / `to a random opponent` on a `deal` effect sets `target: 'allEnemies' | 'randomEnemy'`. Inside a trigger, a bare `deal` defaults to a random opponent; other effects (heal/gain/poison) apply to the persistent's owner. (On-play effects still hit `ctx.target`; targeting words there are currently ignored.)

**Modifiers** — the two stat-changing persistents: `Snow clouds heal 2 instead of 1.` → `{ modifier: 'snowHealBonus', amount: 1 }`, and `Fog clouds no longer force a discard.` → `{ modifier: 'suppressFogDiscard' }`.

**`Claw.`** — the Crab's keyword, written as a sentence of its own (`Claw. Deal 4 damage.`) so it can't be mistaken for a verb. It parses to `{ modifier: 'claw' }` and yields **no on-play action**: it marks the card as one that plays for free when *discarded*. The card's other statements are its effects as normal, whether played from hand or fired by Claw. Resolution lives in `src/cards/match/claw.ts` — see `docs/triggers.md`.

## Scaling (`deal` amounts that read state)

A `deal` can scale off the caster's state instead of a fixed number. Two forms, both set `effect.scale = { per: <metric> }` where the effective amount is `(amount ?? 1) × metric`:

| English                                   | AST                                                    | At reduce time      |
|-------------------------------------------|--------------------------------------------------------|---------------------|
| `Deal damage equal to your energy.`       | `{ verb:'deal', scale:{ per:'energy' } }`              | `1 × energy`        |
| `Deal 3 damage for each unique cloud.`    | `{ verb:'deal', amount:3, scale:{ per:'uniqueClouds' } }` | `3 × unique clouds` |
| `Deal 1 damage for each minion.`          | `{ verb:'deal', amount:1, scale:{ per:'minions' } }`   | `1 × minions`       |
| `Deal 1 damage for each card discarded this turn.` | `{ verb:'deal', amount:1, scale:{ per:'cardsDiscardedThisTurn' } }` | `1 × discards this turn` |
| `Deal 1 damage for each storm cloud.`     | `{ verb:'deal', amount:1, scale:{ per:'stormClouds' } }` | `1 × storm clouds`  |

Metrics (`ScaleMetric` in `shared`): resources `energy`/`poison`/`block`/`shield`/`defense`/`power`/`bravery`, and counts `clouds`/`uniqueClouds`/`minions`/`cardsDiscardedThisTurn`, and the per-kind cloud counts `lightningClouds`/`stormClouds`/`snowClouds`/`fogClouds` (naming a type in "for each <type> cloud" narrows the count). The last is a per-turn counter on the combatant (`discardedThisTurn`), bumped by real discards only and zeroed by the `ClearTurnCounters` action that the start-of-turn cascade runs beside `ClearBlock` — so a card being *played* into the discard pile never inflates it. `defense` is **block + shield** combined (e.g. Hurl's "Deal damage equal to your defense"). Like Venom/Drink, **scaling resolves in the reducer**: the resolver emits a `DealDamageScaled` action and `metricValue(state, self, per)` computes the amount at apply time (so ordering within a card is respected). Scaling works on `deal`, `gain` and `poison` — the resource verbs emit `GainScaled`, which reads the metric at reduce time exactly as `DealDamageScaled` does. On any other verb it is a diagnostic, not a silent miss. Omitting the per-unit amount (`Poison for each card played this turn.`) reads as one-for-one.

## Adding a verb / keyword

1. Extend the grammar in `parser.ts` (and the AST in `ast.ts` if a new node shape is needed).
2. Map the new verb to atomic actions in `resolver.ts`. Add new atomic actions in `src/engine/actions` + handle them in the reducer if required.
3. Add example cards to `src/cards/definitions/` and register them.
4. Add tests (tokenizer/parser/resolver + a card fixture). See `docs/testing-strategy.md`.
5. Update this doc's grammar table.

## Design target vocabulary

The game design (`reference/design.md`) is written in exactly this spirit — every card is English rules text — so it's the real target this DSL grows toward. The Cloud and Wizard flat-effect cards are now authored against the grammar above (`src/cards/definitions/cloud.ts`, `wizard.ts`). Still to build:

- ✅ **Scaling** — `deal damage equal to your <resource>` and `deal N damage for each [unique] cloud/minion`, resolved in the reducer via `DealDamageScaled` + `metricValue`. Still open: scaling on non-`deal` effects (Pile Up's "gain shield for each minion in discard", Vial's "poison for each card played"), "Double your Poison", and metrics that need new counters (cards-played-this-turn, discard-pile contents).
- ✅ **Triggers, conditions, targeting, modifiers** — persistents authored in English (`src/cards/definitions/*-persistents.ts`), compiled by `src/cards/match/compile-persistent.ts`. Still open: more trigger events (draw, block, gain X), richer conditions, and on-play AoE targeting.
- **More verbs:** `burn`, `find` (Writer), `discard <N> cards` (Crab), Blank/Add (Old Lady), etc.

The design also implies **card attributes** that `CardDef` (currently just `id / name / cost / text`) doesn't carry yet: a **character**, a **type** (Attack / Skill / Persistent), and card **keywords** (Claw, Minion, Unplayable, Blank, Add). For now character is expressed by which definitions file a card lives in and keywords like Venom/Minion are parsed from the text; whether they become structured `CardDef` fields is still an open modeling question.

Treat the above as direction, not a spec. Keep the grammar small until real cards demand more.

## Design directions (later, not decided)

- Targets ("Deal 6 damage to ALL enemies"), conditions ("If you have block, …"), triggers ("Whenever you draw a card, …"), keywords (Exhaust, Vulnerable), scaling ("Deal damage equal to your block").
- Whether the grammar stays hand-written or moves to a small parser-combinator/PEG once it grows.
- How ambiguity and pluralization are handled ("card" vs "cards").

Keep the grammar small until real cards demand more.
