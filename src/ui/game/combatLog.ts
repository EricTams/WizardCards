/**
 * Combat log formatting — turning the engine's `GameEvent` stream into readable
 * lines, so a player can see exactly how a card resolved (this is the required
 * game-log feature from `docs/atomic-actions.md`). Formatting lives in the UI
 * layer; the engine only emits structured events.
 */
import type { GameEvent, GameState } from '@engine/index';
import type { CardId, CloudType } from '@shared/index';

export type LogSide = 'player' | 'enemy' | 'neutral';

/** One log block: a header (a card play or a turn marker) + its effect lines. */
export interface LogEntry {
  readonly id: number;
  readonly title: string;
  readonly lines: readonly string[];
  readonly side: LogSide;
}

const CLOUD_NAME: Record<CloudType, string> = { lightning: 'Lightning', storm: 'Storm', snow: 'Snow', fog: 'Fog' };

/** Map every combatant id to its display name (for "→ The Cloud" phrasing). */
export function nameMap(state: GameState): Record<string, string> {
  const m: Record<string, string> = { [state.player.id]: state.player.name };
  for (const e of state.enemies) m[e.id] = e.name;
  return m;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A signed amount, so a loss reads "-1" rather than "+-1". */
const signed = (n: number): string => (n < 0 ? `−${-n}` : `+${n}`);

/** One event → one human line, or null for structural/no-op events (skipped). */
export function describeEvent(e: GameEvent, names: Record<string, string>): string | null {
  const who = (id: string) => names[id] ?? 'someone';
  switch (e.type) {
    case 'DamageDealt': {
      const blocked = e.amount - e.unblocked;
      const base = `${e.unblocked} damage → ${who(e.target)}`;
      return blocked > 0 ? `${base} (${blocked} blocked)` : base;
    }
    case 'BlockGained':
      return e.amount ? `+${e.amount} block → ${who(e.target)}` : null;
    case 'ShieldGained':
      return e.amount ? `+${e.amount} shield → ${who(e.target)}` : null;
    case 'Healed':
      return e.amount ? `+${e.amount} HP → ${who(e.target)}` : null;
    case 'EnergyGained':
      return e.amount ? `+${e.amount} energy → ${who(e.target)}` : null;
    case 'PoisonChanged':
      return e.amount > 0 ? `+${e.amount} poison → ${who(e.target)}` : `poison spent (${-e.amount})`;
    case 'PowerGained':
      return e.amount ? `${signed(e.amount)} power → ${who(e.target)}` : null;
    case 'BraveryGained':
      return e.amount ? `${signed(e.amount)} bravery → ${who(e.target)}` : null;
    case 'CraftChanged':
      return e.amount ? `${signed(e.amount)} craft → ${who(e.target)}` : null;
    case 'CraftBurned':
      return e.amount ? `burned ${e.amount} craft` : null;
    case 'HpLost':
      return e.amount ? `−${e.amount} HP → ${who(e.target)}` : null;
    case 'KeywordGranted':
      return e.cards.length ? `${plural(e.cards.length, 'card')} gained ${e.keyword}` : null;
    case 'CardsMarked':
      if (e.cards.length === 0) return null;
      return e.mark
        ? `marked ${plural(e.cards.length, 'card')} with ${e.mark} ${e.value}`
        : `${plural(e.cards.length, 'card')} lost their markings`;
    case 'AddWindowSet':
      return e.value ? `${who(e.target)} plays a Blank — Add cards are free` : null;
    case 'NextTurnGranted':
      return e.amount ? `next turn: +${e.amount} ${e.resource}` : null;
    case 'CloudsCreated':
      return e.count ? `+${plural(e.count, `${CLOUD_NAME[e.cloudType]} cloud`)} → ${who(e.target)}` : null;
    case 'CloudsRemoved':
      return e.count ? `removed ${plural(e.count, 'cloud')}` : null;
    case 'CardsDrawn':
      return e.cards.length ? `${who(e.owner)} drew ${plural(e.cards.length, 'card')}` : null;
    case 'CardsDiscarded':
      return e.cards.length ? `${who(e.owner)} discarded ${e.cards.length}` : null;
    case 'MinionSummoned':
      return `${who(e.owner)} summons a minion`;
    case 'MinionDiscarded':
      return e.count ? `${who(e.owner)} loses ${plural(e.count, 'minion')}` : null;
    case 'DeckReshuffled':
      return `${who(e.owner)} reshuffles their deck`;
    case 'PersistentAdded':
      return `${who(e.target)} gains a persistent`;
    // Structural / bookkeeping — no line:
    case 'TurnStarted':
    case 'TurnEnded':
    case 'PhaseChanged':
    case 'BlockCleared':
    case 'EnergySet':
      return null;
    default:
      return null;
  }
}

/**
 * Format an event batch into effect lines. `skipCardId` drops the played card's
 * own hand→discard move (bookkeeping, not an effect) so a play reads as just its
 * effects.
 */
export function describeEvents(
  events: readonly GameEvent[],
  names: Record<string, string>,
  opts: { skipCardId?: CardId } = {},
): string[] {
  const lines: string[] = [];
  let skipped = false;
  for (const e of events) {
    if (!skipped && opts.skipCardId && e.type === 'CardsDiscarded' && e.cards.length === 1 && e.cards[0] === opts.skipCardId) {
      skipped = true;
      continue;
    }
    const line = describeEvent(e, names);
    if (line) lines.push(line);
  }
  return lines;
}
