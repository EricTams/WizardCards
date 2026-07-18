import { useEffect, useMemo, useState } from 'react';
import {
  ALL_CARDS,
  tokenize,
  parse,
  compile,
  applyOverrides,
  EMPTY_OVERRIDES,
  diffCards,
  isEmptyDiff,
  buildReport,
  type CardDef,
  type CardOverrides,
  type Token,
} from '@cards/index';
import { applyAll, type Action, type GameState } from '@engine/index';
import { cardId, type EntityId } from '@shared/index';
import { loadOverrides, saveOverrides, clearOverrides } from '@ui/cardlab/storage';
import { makeArena, addTarget, removeTarget } from '@ui/cardlab/arena';
import { GameView } from '@ui/game/GameView';

/**
 * The Card Lab: author cards (Edit mode) and test them against a configurable
 * play area rendered with the real GameView (Play test mode). Edits persist to
 * localStorage as a CardOverrides overlay; a diff report can be exported. This
 * component consumes only the engine and cards public APIs — it owns no game logic.
 */
type Mode = 'edit' | 'play';

const baselineById = new Map(ALL_CARDS.map((c) => [c.id as string, c]));

export function CardLab() {
  const [overrides, setOverrides] = useState<CardOverrides>(loadOverrides);
  const [selectedId, setSelectedId] = useState<string | null>(ALL_CARDS[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>('edit');

  // The play area (arena) and which target the card hits.
  const [arena, setArena] = useState<GameState>(makeArena);
  const [targetId, setTargetId] = useState<EntityId | null>(null);
  const [lastPlay, setLastPlay] = useState<string>('');

  useEffect(() => {
    saveOverrides(overrides);
  }, [overrides]);

  const cards = useMemo(() => applyOverrides(ALL_CARDS, overrides), [overrides]);
  const diff = useMemo(() => diffCards(ALL_CARDS, cards), [cards]);
  const changedIds = useMemo(() => {
    const s = new Set<string>();
    diff.added.forEach((c) => s.add(c.id));
    diff.modified.forEach((m) => s.add(m.id));
    return s;
  }, [diff]);

  const selected = cards.find((c) => c.id === selectedId) ?? cards[0] ?? null;
  const effectiveTarget: EntityId | null = targetId ?? arena.enemies[0]?.id ?? null;

  // The atomic actions the selected card would apply to the current target.
  const previewActions = useMemo<Action[]>(() => {
    if (!selected || !effectiveTarget) return [];
    const compiled = compile(selected.text);
    if (!compiled.ok) return [];
    const ctx = { self: arena.player.id, target: effectiveTarget };
    return compiled.value.map((produce) => produce(ctx));
  }, [selected, effectiveTarget, arena.player.id]);

  // ---- card editing ----------------------------------------------------------
  function editSelected(patch: Partial<Pick<CardDef, 'name' | 'cost' | 'text'>>) {
    if (!selected) return;
    const next: CardDef = { ...selected, ...patch, id: selected.id };
    setOverrides((prev) => ({ ...prev, edited: { ...prev.edited, [selected.id]: next } }));
  }

  function addCard() {
    const id = `custom-${Date.now()}`;
    const card: CardDef = { id: cardId(id), name: 'New Card', cost: 1, text: 'Deal 1 damage.' };
    setOverrides((prev) => ({
      ...prev,
      edited: { ...prev.edited, [id]: card },
      removed: prev.removed.filter((r) => r !== id),
    }));
    setSelectedId(id);
  }

  function resetCard(id: string) {
    setOverrides((prev) => {
      const edited = { ...prev.edited };
      delete edited[id];
      return { ...prev, edited, removed: prev.removed.filter((r) => r !== id) };
    });
  }

  function deleteCard(id: string) {
    setOverrides((prev) => {
      const edited = { ...prev.edited };
      delete edited[id];
      const removed = baselineById.has(id) ? Array.from(new Set([...prev.removed, id])) : prev.removed;
      return { ...prev, edited, removed };
    });
  }

  function resetAll() {
    clearOverrides();
    setOverrides(EMPTY_OVERRIDES);
  }

  function exportDiff() {
    const report = buildReport(diff, new Date().toISOString());
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wizardcards-card-diff-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- play area -------------------------------------------------------------
  function playSelected() {
    if (previewActions.length === 0) return;
    setArena((a) => applyAll(a, previewActions).state);
    setLastPlay(previewActions.map((x) => x.type).join(' → '));
  }
  function removeTgt(id: EntityId) {
    setArena((a) => removeTarget(a, id));
    setTargetId((t) => (t === id ? null : t));
  }
  function resetArena() {
    setArena(makeArena());
    setTargetId(null);
    setLastPlay('');
  }

  const targetName = arena.enemies.find((e) => e.id === effectiveTarget)?.name ?? null;

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <a href="#/" style={{ textDecoration: 'none', color: '#6c5ce7' }}>
          ← Menu
        </a>
        <h1 style={{ margin: 0 }}>Card Lab</h1>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #6c5ce7' }}>
          <Tab active={mode === 'edit'} onClick={() => setMode('edit')}>
            Edit
          </Tab>
          <Tab active={mode === 'play'} onClick={() => setMode('play')}>
            Play test
          </Tab>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#888' }}>
          {isEmptyDiff(diff)
            ? 'no changes'
            : `${diff.added.length} added · ${diff.modified.length} modified · ${diff.removed.length} removed`}
        </span>
        <button onClick={exportDiff} disabled={isEmptyDiff(diff)} style={btn('#6c5ce7')}>
          Export diff report
        </button>
        <button onClick={resetAll} style={btn('#c0392b', true)}>
          Reset all
        </button>
      </header>

      {mode === 'edit' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
          <CardList
            cards={cards}
            selectedId={selected?.id ?? null}
            changedIds={changedIds}
            onSelect={setSelectedId}
            onAdd={addCard}
          />
          {selected ? (
            <CardEditor
              card={selected}
              isBaseline={baselineById.has(selected.id)}
              isChanged={changedIds.has(selected.id)}
              onEdit={editSelected}
              onReset={() => resetCard(selected.id)}
              onDelete={() => deleteCard(selected.id)}
            />
          ) : (
            <p style={{ color: '#888' }}>No cards. Add one to get started.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={labelStyle}>Card under test</span>
              <select
                value={selected?.id ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
                style={inputStyle}
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <div style={{ border: '1px solid #eee', borderRadius: 6, padding: 10, background: '#fafafa' }}>
                <div style={{ fontStyle: 'italic' }}>{selected.text}</div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#555' }}>
                  <strong>Compiles to:</strong>{' '}
                  {previewActions.length > 0 ? (
                    previewActions.map((x) => x.type).join(' → ')
                  ) : (
                    <span style={{ color: '#c0392b' }}>nothing (parse error or no target)</span>
                  )}
                </div>
              </div>
            )}

            <div style={{ fontSize: 13, color: '#555' }}>
              Targeting: <strong>{targetName ?? 'none — add or select a target'}</strong>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={playSelected} disabled={previewActions.length === 0} style={btn('#27ae60')}>
                ▶ Play card
              </button>
              <button onClick={resetArena} style={btn('#7f8c8d', true)}>
                ↺ Reset arena
              </button>
            </div>

            {lastPlay && (
              <div style={{ fontSize: 12, color: '#888' }}>Last play: {lastPlay}</div>
            )}
            <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
              Click a target to aim at it. "Deal" hits the selected target; "Gain" applies to the player.
            </p>
          </div>

          <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
            <GameView
              state={arena}
              selectedTargetId={effectiveTarget}
              onSelectTarget={setTargetId}
              onRemoveTarget={removeTgt}
              onAddTarget={() => setArena((a) => addTarget(a))}
            />
          </section>
        </div>
      )}
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        font: 'inherit',
        padding: '6px 14px',
        border: 'none',
        cursor: 'pointer',
        background: active ? '#6c5ce7' : 'white',
        color: active ? 'white' : '#6c5ce7',
      }}
    >
      {children}
    </button>
  );
}

function CardList({
  cards,
  selectedId,
  changedIds,
  onSelect,
  onAdd,
}: {
  cards: readonly CardDef[];
  selectedId: string | null;
  changedIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <nav style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
      {cards.map((c) => {
        const active = c.id === selectedId;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              textAlign: 'left',
              font: 'inherit',
              padding: '8px 12px',
              border: 'none',
              borderBottom: '1px solid #eee',
              background: active ? '#efeafd' : 'white',
              cursor: 'pointer',
            }}
          >
            <span>{c.name}</span>
            {changedIds.has(c.id) && <span title="modified" style={{ color: '#e67e22' }}>●</span>}
          </button>
        );
      })}
      <button
        onClick={onAdd}
        style={{ width: '100%', font: 'inherit', padding: '8px 12px', border: 'none', background: '#fafafa', cursor: 'pointer', color: '#6c5ce7' }}
      >
        + New card
      </button>
    </nav>
  );
}

function CardEditor({
  card,
  isBaseline,
  isChanged,
  onEdit,
  onReset,
  onDelete,
}: {
  card: CardDef;
  isBaseline: boolean;
  isChanged: boolean;
  onEdit: (patch: Partial<Pick<CardDef, 'name' | 'cost' | 'text'>>) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const tokens = useMemo(() => tokenize(card.text), [card.text]);
  const parsed = useMemo(() => parse(card.text), [card.text]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 4, flex: 1, minWidth: 160 }}>
          <span style={labelStyle}>Name</span>
          <input value={card.name} onChange={(e) => onEdit({ name: e.target.value })} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 4, width: 90 }}>
          <span style={labelStyle}>Cost</span>
          <input
            type="number"
            value={card.cost}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              onEdit({ cost: Number.isNaN(n) ? 0 : n });
            }}
            style={inputStyle}
          />
        </label>
        <span style={{ color: '#aaa', fontSize: 12 }}>id: {card.id}</span>
      </div>

      <label style={{ display: 'grid', gap: 4 }}>
        <span style={labelStyle}>Card text (English)</span>
        <textarea
          value={card.text}
          onChange={(e) => onEdit({ text: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          aria-label="Card text"
        />
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        {isBaseline && (
          <button onClick={onReset} disabled={!isChanged} style={btn('#7f8c8d', true)}>
            Reset to baseline
          </button>
        )}
        <button onClick={onDelete} style={btn('#c0392b', true)}>
          Delete card
        </button>
      </div>

      <Panel title="Tokens">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tokens.map((t, i) => (
            <TokenChip key={i} token={t} />
          ))}
        </div>
      </Panel>

      <Panel title="Parse">
        {parsed.ok ? (
          <pre style={{ margin: 0 }}>{JSON.stringify(parsed.value.effects, null, 2)}</pre>
        ) : (
          <ul style={{ margin: 0, color: '#c0392b' }}>
            {parsed.errors.map((d, i) => (
              <li key={i}>
                [{d.start}–{d.end}] {d.message}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
        Switch to <strong>Play test</strong> to try this card against targets in the play area.
      </p>
    </div>
  );
}

// ---- shared presentational helpers -----------------------------------------

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#888',
};

const inputStyle: React.CSSProperties = {
  font: 'inherit',
  padding: 8,
  border: '1px solid #ccc',
  borderRadius: 4,
  boxSizing: 'border-box',
  width: '100%',
};

function btn(color: string, outline = false): React.CSSProperties {
  return {
    font: 'inherit',
    padding: '8px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    border: `1px solid ${color}`,
    background: outline ? 'white' : color,
    color: outline ? color : 'white',
  };
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
      <h2 style={{ ...labelStyle, margin: '0 0 8px' }}>{title}</h2>
      {children}
    </section>
  );
}

const TOKEN_COLORS: Record<Token['type'], string> = {
  word: '#2c3e50',
  number: '#2980b9',
  punctuation: '#7f8c8d',
  unknown: '#c0392b',
};

function TokenChip({ token }: { token: Token }) {
  return (
    <span
      style={{
        border: `1px solid ${TOKEN_COLORS[token.type]}`,
        color: TOKEN_COLORS[token.type],
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 13,
      }}
      title={`${token.type} @ ${token.start}–${token.end}`}
    >
      {token.value}
    </span>
  );
}
