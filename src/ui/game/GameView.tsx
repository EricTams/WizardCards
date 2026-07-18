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
        {combatant.block > 0 && (
          <span title="block" style={{ color: '#2980b9', fontSize: 13 }}>
            🛡 {combatant.block}
          </span>
        )}
      </div>
      <div style={{ marginTop: 8, height: 10, background: '#eee', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: accent, transition: 'width 120ms' }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: '#555' }}>
        {combatant.hp} / {combatant.maxHp} HP
      </div>
    </div>
  );
}
