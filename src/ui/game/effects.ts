/**
 * Play-animation model — turning the engine's `GameEvent` stream into the visual
 * "impacts" the effects overlay renders (a projectile + a floating number per
 * effect). Pure and presentation-only: this is the single place that decides how
 * each effect *looks*, so restyling is a one-file change.
 */
import type { GameEvent } from '@engine/index';
import type { CloudType, EntityId } from '@shared/index';

/** A point in viewport pixels. */
export interface Anchor {
  readonly x: number;
  readonly y: number;
}

export type ImpactKind =
  | 'damage'
  | 'block'
  | 'shield'
  | 'heal'
  | 'energy'
  | 'poison'
  | 'cloud'
  | 'draw'
  | 'power'
  | 'bravery'
  | 'minion';

/** One visible consequence of a play: a projectile (optional) + a target number. */
export interface Impact {
  readonly kind: ImpactKind;
  /** Whose combatant the effect lands on, relative to the caster. */
  readonly side: 'self' | 'opp';
  /** The floating text at the target ("-4", "+3", "❄×2"). */
  readonly text: string;
  /** Small glyph carried by the projectile. */
  readonly symbol: string;
  readonly color: string;
  /** Whether a projectile travels to the target (self-buffs just pop in place). */
  readonly fly: boolean;
}

const STYLE: Record<ImpactKind, { color: string; symbol: string }> = {
  damage: { color: '#ff4d4d', symbol: '✦' },
  block: { color: '#4da3ff', symbol: '▮' },
  shield: { color: '#3ad1c0', symbol: '◆' },
  heal: { color: '#5ad65a', symbol: '✚' },
  energy: { color: '#ffcc33', symbol: '⚡' },
  poison: { color: '#b06cff', symbol: '☠' },
  cloud: { color: '#e8edf2', symbol: '☁' },
  draw: { color: '#ffffff', symbol: '🂠' },
  power: { color: '#ff7043', symbol: '💪' },
  bravery: { color: '#7fa8ff', symbol: '✒' },
  minion: { color: '#7bd66a', symbol: '⚔' },
};

const CLOUD_GLYPH: Record<CloudType, string> = { lightning: '⚡', storm: '🌩', snow: '❄', fog: '🌫' };

/** The visible impacts a play produces, in order, from its event batch. */
export function impactsFromEvents(events: readonly GameEvent[], actorId: EntityId): Impact[] {
  const out: Impact[] = [];
  const sideOf = (target: string): 'self' | 'opp' => (target === actorId ? 'self' : 'opp');
  const mk = (kind: ImpactKind, side: 'self' | 'opp', text: string, over: Partial<Impact> = {}): Impact => ({
    kind,
    side,
    text,
    symbol: STYLE[kind].symbol,
    color: STYLE[kind].color,
    fly: true,
    ...over,
  });

  for (const e of events) {
    switch (e.type) {
      case 'DamageDealt':
        if (e.amount > 0) out.push(mk('damage', sideOf(e.target), e.unblocked > 0 ? `-${e.unblocked}` : 'blocked'));
        break;
      case 'BlockGained':
        if (e.amount) out.push(mk('block', sideOf(e.target), `+${e.amount}`, { fly: false }));
        break;
      case 'ShieldGained':
        if (e.amount) out.push(mk('shield', sideOf(e.target), `+${e.amount}`, { fly: false }));
        break;
      case 'Healed':
        if (e.amount) out.push(mk('heal', sideOf(e.target), `+${e.amount}`, { fly: false }));
        break;
      case 'EnergyGained':
        if (e.amount) out.push(mk('energy', sideOf(e.target), `+${e.amount}`, { fly: false }));
        break;
      case 'PoisonChanged':
        if (e.amount > 0) out.push(mk('poison', sideOf(e.target), `+${e.amount}`, { fly: false }));
        break;
      case 'PowerGained':
        if (e.amount) out.push(mk('power', sideOf(e.target), `+${e.amount}`, { fly: false }));
        break;
      case 'BraveryGained':
        if (e.amount) out.push(mk('bravery', sideOf(e.target), `+${e.amount}`, { fly: false }));
        break;
      case 'CloudsCreated':
        if (e.count)
          out.push(mk('cloud', sideOf(e.target), `${CLOUD_GLYPH[e.cloudType]}×${e.count}`, { symbol: CLOUD_GLYPH[e.cloudType] }));
        break;
      case 'MinionSummoned':
        out.push(mk('minion', 'self', 'summon', { fly: false }));
        break;
      case 'MinionDiscarded':
        // An attack (or effect) destroyed a minion — a hit on that side.
        if (e.count) out.push(mk('damage', e.owner === actorId ? 'self' : 'opp', '💥'));
        break;
      case 'CardsDrawn':
        if (e.cards.length) out.push(mk('draw', 'self', `draw ${e.cards.length}`, { fly: false }));
        break;
      default:
        break;
    }
  }
  return out;
}

/** The three scene anchor points, in current viewport pixels. */
export function sceneAnchor(which: 'card' | 'player' | 'enemy'): Anchor {
  const w = window.innerWidth;
  const h = window.innerHeight;
  switch (which) {
    case 'card':
      return { x: w * 0.5, y: h * 0.48 };
    case 'player':
      return { x: w * 0.16, y: h * 0.56 };
    case 'enemy':
      return { x: w * 0.84, y: h * 0.34 };
  }
}

/** Resolve an impact's `side` to a concrete combatant anchor given who acted. */
export function impactAnchor(actorSide: 'player' | 'enemy', side: 'self' | 'opp'): Anchor {
  const target = side === 'self' ? actorSide : actorSide === 'player' ? 'enemy' : 'player';
  return sceneAnchor(target);
}
