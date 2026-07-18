/**
 * Seeded, deterministic PRNG (mulberry32).
 *
 * INVARIANT: the RNG's entire state is a single number that lives INSIDE
 * GameState. Every random draw returns both the value AND the next RNG state —
 * it never mutates in place and never touches Math.random. Same seed + same
 * sequence of draws => identical results, forever. This is what makes replay,
 * time-travel, deterministic tests, and multiplayer reconciliation possible.
 */

export type RngState = number;

/** Derive an initial RNG state from an arbitrary string/number seed. */
export function seedRng(seed: string | number): RngState {
  // xmur3-style string hash -> 32-bit unsigned integer.
  let h = 1779033703 ^ String(seed).length;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Advance the RNG once. Returns a float in [0, 1) and the next state. */
export function nextFloat(state: RngState): { value: number; state: RngState } {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: (t >>> 0) };
}

/** Integer in [min, max] inclusive. */
export function nextInt(
  state: RngState,
  min: number,
  max: number,
): { value: number; state: RngState } {
  const r = nextFloat(state);
  const span = max - min + 1;
  return { value: min + Math.floor(r.value * span), state: r.state };
}

/**
 * Fisher–Yates shuffle driven by the seeded RNG. Pure: returns a new array and
 * the advanced RNG state; the input is not mutated.
 */
export function shuffle<T>(
  items: readonly T[],
  state: RngState,
): { value: T[]; state: RngState } {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const draw = nextInt(s, 0, i);
    s = draw.state;
    const j = draw.value;
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return { value: out, state: s };
}
