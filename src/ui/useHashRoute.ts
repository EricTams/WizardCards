import { useSyncExternalStore } from 'react';

/**
 * Minimal hash-based router. Hash routing keeps deep links working on GitHub
 * Pages without a 404.html trick (see docs/architecture.md). Returns the current
 * hash, e.g. '#/cardlab', defaulting to '#/'.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function getSnapshot(): string {
  return window.location.hash || '#/';
}

export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
