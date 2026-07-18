# ADR 0001 — Vite + Vitest + React, static to GitHub Pages

**Status:** accepted · Phase 0

## Context

Greenfield TypeScript card game targeting GitHub Pages (static hosting). We need a build tool, a test runner, and a UI approach for the Card Lab (a live text editor with real-time compile preview).

## Decision

- **Vite** for build/dev. First-class TS, instant HMR (ideal for the Card Lab's live-parse UX), and `vite build` emits a fully static bundle for Pages. `base: '/WizardCards/'` handles the project-page sub-path.
- **Vitest** for tests — shares Vite's TS pipeline (one config), fast watch, snapshots, built-in v8 coverage. **fast-check** for property-based tests.
- **npm** as package manager (already present; simplest CI caching).
- **React** (`@vitejs/plugin-react`) for the UI — lowest-risk reactive rendering for the Card Lab. Critically, React is confined to `src/ui/`; the engine and cards layers are framework-free, so this choice is reversible.
- **GitHub Actions → Pages** via the official artifact flow (`upload-pages-artifact` + `deploy-pages`), not a `gh-pages` branch.

## Consequences

- One mental model for build + test.
- Swapping the UI framework later touches only `src/ui/`.
- Deep-linking on Pages needs hash routing or a `404.html` copy once a client router is added.
