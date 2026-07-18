import type { Combatant, GameState } from '@engine/index';
import type { EntityId } from '@shared/index';

/**
 * GameView — renders a GameState (player + enemies). The single, reusable game
 * renderer: the real game will render read-only; the Card Lab passes the optional
 * handlers to make the enemy row an editable play area. It reads state only and
 * never mutates it.
 */
export interface GameViewProps {
  readonly state: GameState;
  readonly selectedTargetId?: EntityId | null;
  readonly onSelectTarget?: (id: EntityId) => void;
  readonly onRemoveTarget?: (id: EntityId) => void;
  readonly onAddTarget?: () => void;
}

export function GameView({
  state,
  selectedTargetId,
  onSelectTarget,
  onRemoveTarget,
  onAddTarget,
}: GameViewProps) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ color: '#888', fontSize: 13 }}>
        Turn {state.turn} · {state.phase} · hand {state.hand.length} · draw {state.drawPile.length}
      </div>

      <CombatantCard combatant={state.player} accent="#2980b9" />

      <div style={{ color: '#aaa', textAlign: 'center', fontWeight: 600 }}>VS</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {state.enemies.map((enemy) => (
          <CombatantCard
            key={enemy.id}
            combatant={enemy}
            accent="#c0392b"
            selected={enemy.id === selectedTargetId}
            onSelect={onSelectTarget ? () => onSelectTarget(enemy.id) : undefined}
            onRemove={onRemoveTarget ? () => onRemoveTarget(enemy.id) : undefined}
          />
        ))}
        {state.enemies.length === 0 && (
          <span style={{ color: '#aaa', alignSelf: 'center' }}>No targets.</span>
        )}
        {onAddTarget && (
          <button
            onClick={onAddTarget}
            style={{
              font: 'inherit',
              minWidth: 120,
              minHeight: 96,
              border: '1px dashed #c0392b',
              color: '#c0392b',
              background: 'white',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            + Add target
          </button>
        )}
      </div>
    </div>
  );
}

function CombatantCard({
  combatant,
  accent,
  selected,
  onSelect,
  onRemove,
}: {
  combatant: Combatant;
  accent: string;
  selected?: boolean;
  onSelect?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  const pct = combatant.maxHp > 0 ? Math.max(0, (combatant.hp / combatant.maxHp) * 100) : 0;
  const dead = combatant.hp <= 0;
  return (
    <div
      onClick={onSelect}
      style={{
        position: 'relative',
        minWidth: 160,
        padding: 12,
        border: `2px solid ${selected ? accent : '#ddd'}`,
        borderRadius: 8,
        background: selected ? `${accent}12` : 'white',
        cursor: onSelect ? 'pointer' : 'default',
        opacity: dead ? 0.5 : 1,
      }}
    >
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove target"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#999',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong>{combatant.name}</strong>
      </div>
      <div style={{ marginTop: 8, height: 10, background: '#eee', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: accent, transition: 'width 120ms' }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: '#555' }}>
        {combatant.hp} / {combatant.maxHp} HP
      </div>
      <ResourceChips combatant={combatant} />
    </div>
  );
}

const CLOUD_ICON: Record<string, string> = {
  lightning: '⚡',
  storm: '🌩',
  snow: '❄️',
  fog: '🌫',
};

/** Compact display of a combatant's resources, clouds, minions, and persistents. */
function ResourceChips({ combatant }: { combatant: Combatant }) {
  const chips: { label: string; color: string }[] = [];
  if (combatant.block > 0) chips.push({ label: `🛡 ${combatant.block}`, color: '#2980b9' });
  if (combatant.shield > 0) chips.push({ label: `🛡🛡 ${combatant.shield}`, color: '#16a085' });
  if (combatant.energy > 0) chips.push({ label: `⚡e ${combatant.energy}`, color: '#f39c12' });
  if (combatant.poison > 0) chips.push({ label: `☠ ${combatant.poison}`, color: '#8e44ad' });
  if (combatant.power > 0) chips.push({ label: `💪 ${combatant.power}`, color: '#c0392b' });
  if (combatant.bravery > 0) chips.push({ label: `✒ ${combatant.bravery}`, color: '#2c3e50' });

  const cloudCounts = combatant.clouds.reduce<Record<string, number>>((m, c) => {
    m[c] = (m[c] ?? 0) + 1;
    return m;
  }, {});

  if (chips.length === 0 && combatant.clouds.length === 0 && combatant.minions.length === 0 && combatant.persistents.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {chips.map((c, i) => (
        <span key={i} style={chipStyle(c.color)}>
          {c.label}
        </span>
      ))}
      {Object.entries(cloudCounts).map(([type, n]) => (
        <span key={type} style={chipStyle('#7f8c8d')} title={`${type} cloud`}>
          {CLOUD_ICON[type] ?? '☁'} {n}
        </span>
      ))}
      {combatant.minions.length > 0 && (
        <span style={chipStyle('#27ae60')} title="minions in play">
          👾 {combatant.minions.length}
        </span>
      )}
      {combatant.persistents.map((id) => (
        <span key={id} style={chipStyle('#6c5ce7')} title="persistent in play">
          ∞ {id}
        </span>
      ))}
    </div>
  );
}

function chipStyle(color: string): React.CSSProperties {
  return {
    border: `1px solid ${color}`,
    color,
    borderRadius: 4,
    padding: '1px 5px',
    fontSize: 12,
    whiteSpace: 'nowrap',
  };
}
