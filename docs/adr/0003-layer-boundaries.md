# ADR 0003 — Lint-enforced layer boundaries (ui → cards → engine → shared)

**Status:** accepted · Phase 0

## Context

The state/display separation and the engine's purity are only real if they can't be accidentally violated. We want the engine to run headless (tests, future server) and the display to be swappable.

## Decision

Four layers with a strict one-way dependency direction: `ui → cards → engine → shared`. Enforce it in CI/lint. We use `@typescript-eslint/no-restricted-imports` keyed on the path aliases (`@shared`, `@engine`, `@cards`, `@ui`): each layer's ESLint config block forbids importing aliases to its left.

## Why not `eslint-plugin-boundaries`

We tried it first. In flat config it needs an import resolver to map our path aliases to element types; without that it silently classified nothing and the rule never fired. `no-restricted-imports` matches the import *string* directly — no resolver, no extra dependency, and it verifiably errors on a probe (`engine` importing `@ui`). Simplicity won.

## Consequences

- Cross-layer imports must go through aliases (the convention we already follow) for the rule to catch them; a relative `../../ui` import would need adding to the pattern list. Acceptable given the alias convention.
- Swapping the UI framework or extracting a server touches only the relevant layer.
