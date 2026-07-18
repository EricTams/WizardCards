# WizardCards

A TypeScript roguelike deckbuilder in the spirit of Slay the Spire, with two signature ideas:

- **English-authored cards.** A card's behavior is written in (semi-)natural English and compiled into game effects by a small DSL — no per-card imperative code.
- **A Card Lab.** Type a card and watch it tokenize, parse, and run against a sandbox state in real time.

Built to be **deterministic, testable, and multiplayer-ready**: game state is pure serializable data, and every move is an atomic action applied by a pure reducer, with all randomness driven by a seeded in-state RNG.

> Status: initial scaffold + walking skeleton. Game design (cards, rules, combat) is intentionally not built yet — see `docs/roadmap.md`.

## Quick start

```bash
npm install
npm run dev        # open the Card Lab
npm test           # run the suite
npm run build      # static build to dist/ (deployable to GitHub Pages)
```

## Architecture in one line

`ui → cards → engine → shared` — imports only ever point rightward, enforced by lint. The engine knows nothing about the display, which is what keeps multiplayer and testing tractable.

## Docs

Start with [`docs/vision.md`](docs/vision.md) and [`docs/architecture.md`](docs/architecture.md). Contributor/agent guardrails live in [`CLAUDE.md`](CLAUDE.md).

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages. Enable it once under **Settings → Pages → Source: GitHub Actions**. The site is served under `/WizardCards/` (see `base` in `vite.config.ts`).
