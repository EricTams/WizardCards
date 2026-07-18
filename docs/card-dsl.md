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

## Current grammar (deliberately tiny)

The skeleton understands one statement shape:

```
<verb> <number> <noun> ["."]
```

with `verb ∈ { deal, gain, draw }`:

| English            | AST (EffectNode)                     | Produces                                  |
|--------------------|--------------------------------------|-------------------------------------------|
| `Deal 6 damage.`   | `{ verb: 'deal', amount: 6, ... }`   | `DealDamage(target, 6)`                   |
| `Gain 5 block.`    | `{ verb: 'gain', amount: 5, ... }`   | `GainBlock(self, 5)`                      |
| `Draw 2 cards.`    | `{ verb: 'draw', amount: 2, ... }`   | `DrawCards(2)`                            |

Multiple statements chain: `Deal 4 damage. Gain 2 block.` → two producers.

Anything unrecognized becomes a `Diagnostic` (with a `[start, end)` span) instead of throwing.

## Adding a verb / keyword

1. Extend the grammar in `parser.ts` (and the AST in `ast.ts` if a new node shape is needed).
2. Map the new verb to atomic actions in `resolver.ts`. Add new atomic actions in `src/engine/actions` + handle them in the reducer if required.
3. Add example cards to `src/cards/definitions/` and register them.
4. Add tests (tokenizer/parser/resolver + a card fixture). See `docs/testing-strategy.md`.
5. Update this doc's grammar table.

## Design directions (later, not decided)

- Targets ("Deal 6 damage to ALL enemies"), conditions ("If you have block, …"), triggers ("Whenever you draw a card, …"), keywords (Exhaust, Vulnerable), scaling ("Deal damage equal to your block").
- Whether the grammar stays hand-written or moves to a small parser-combinator/PEG once it grows.
- How ambiguity and pluralization are handled ("card" vs "cards").

Keep the grammar small until real cards demand more.
