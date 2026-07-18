/**
 * localStorage persistence for Card Lab edits.
 *
 * The browser boundary for the pure `CardOverrides` overlay lives here, in the
 * ui layer — the cards layer stays pure and testable. Failures (private mode,
 * quota, corrupt data) degrade gracefully to the empty overlay.
 */
import { EMPTY_OVERRIDES, type CardOverrides, type CardTest } from '@cards/index';

const STORAGE_KEY = 'wizardcards.cardOverrides.v1';
const TESTS_KEY = 'wizardcards.cardTests.v1';

export function loadOverrides(): CardOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_OVERRIDES;
    const parsed = JSON.parse(raw) as Partial<CardOverrides>;
    if (parsed && parsed.version === 1 && parsed.edited && Array.isArray(parsed.removed)) {
      return { version: 1, edited: parsed.edited, removed: parsed.removed };
    }
  } catch {
    // fall through to default
  }
  return EMPTY_OVERRIDES;
}

export function saveOverrides(overrides: CardOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore write failures (e.g. private mode / quota)
  }
}

export function clearOverrides(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Author-defined card tests, persisted separately from the built-in `CARD_TESTS`.
 * A flat list (each test carries its own `cardId`); the Card Lab filters by card.
 */
export function loadUserTests(): CardTest[] {
  try {
    const raw = localStorage.getItem(TESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as CardTest[];
  } catch {
    // fall through to default
  }
  return [];
}

export function saveUserTests(tests: readonly CardTest[]): void {
  try {
    localStorage.setItem(TESTS_KEY, JSON.stringify(tests));
  } catch {
    // ignore write failures (e.g. private mode / quota)
  }
}
