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
  runCardTest,
  snapshotExpect,
  testsForCard,
  playCard,
  startTurn,
  endTurn,
  PERSISTENT_CARDS,
  type CardDef,
  type CardOverrides,
  type CardTest,
  type CardTestSetup,
  type CardTestResult,
  type Token,
} from '@cards/index';
import { applyAll, type Action, type Combatant, type GameState } from '@engine/index';
import { cardId, type EntityId } from '@shared/index';
import {
  loadOverrides,
  saveOverrides,
  clearOverrides,
  loadUserTests,
  saveUserTests,
} from '@ui/cardlab/storage';
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

  // Author-defined card tests (built-in ones live in the cards layer).
  const [userTests, setUserTests] = useState<CardTest[]>(loadUserTests);

  useEffect(() => {
    saveOverrides(overrides);
  }, [overrides]);

  useEffect(() => {
    saveUserTests(userTests);
  }, [userTests]);

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
    const ctx = { self: arena.player.id, target: effectiveTarget, sourceCard: cardId(selected.id) };
    return compiled.value.map((produce) => produce(ctx));
  }, [selected, effectiveTarget, arena.player.id]);

  // ---- card tests ------------------------------------------------------------
  // Tests for the selected card: built-in ones + any the author saved. Each is
  // run against the *current* (possibly edited) card text via the shared runner.
  const cardTests = useMemo<CardTest[]>(() => {
    if (!selected) return [];
    return [...testsForCard(selected.id), ...userTests.filter((t) => t.cardId === selected.id)];
  }, [selected, userTests]);

  const testResults = useMemo<{ test: CardTest; result: CardTestResult; builtin: boolean }[]>(() => {
    if (!selected) return [];
    const builtinCount = testsForCard(selected.id).length;
    return cardTests.map((test, i) => ({
      test,
      result: runCardTest(selected, test),
      builtin: i < builtinCount,
    }));
  }, [selected, cardTests]);

  /** Snapshot the current arena as a test setup for the runner's single target. */
  function captureSetup(): CardTestSetup {
    const enemy = arena.enemies.find((e) => e.id === effectiveTarget) ?? arena.enemies[0];
    const pick = (c: Combatant): Partial<Combatant> => ({
      hp: c.hp,
      maxHp: c.maxHp,
      block: c.block,
      shield: c.shield,
      energy: c.energy,
      poison: c.poison,
      power: c.power,
      bravery: c.bravery,
      clouds: c.clouds,
      minions: c.minions,
    });
    return {
      player: pick(arena.player),
      ...(enemy ? { target: pick(enemy) } : {}),
      hand: arena.hand,
      drawPile: arena.drawPile,
      discardPile: arena.discardPile,
    };
  }

  function addTestFromArena() {
    if (!selected) return;
    const snap = snapshotExpect(selected, captureSetup());
    if (!snap.ok) {
      setLastPlay(`Can't capture test: ${snap.error}`);
      return;
    }
    const n = userTests.filter((t) => t.cardId === selected.id).length + 1;
    const test: CardTest = {
      name: `${selected.name} — captured ${n}`,
      cardId: selected.id,
      setup: captureSetup(),
      expect: snap.expect,
    };
    setUserTests((prev) => [...prev, test]);
  }

  function deleteUserTest(target: CardTest) {
    setUserTests((prev) => prev.filter((t) => t !== target));
  }

  function exportTests() {
    const blob = new Blob([JSON.stringify(userTests, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wizardcards-card-tests-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
  // Card play and turns go through the trigger orchestrator so persistents,
  // clouds, and minions actually fire (not just the card's own atomic actions).
  function playSelected() {
    if (!selected || !effectiveTarget) return;
    const ctx = { self: arena.player.id, target: effectiveTarget, sourceCard: cardId(selected.id) };
    const result = playCard(arena, selected, ctx);
    setArena(result.state);
    setLastPlay(result.events.map((e) => e.type).join(' → ') || '(no effect)');
  }
  function doStartTurn() {
    const result = startTurn(arena);
    setArena(result.state);
    setLastPlay(`Start turn → ${result.events.map((e) => e.type).join(' → ') || '(nothing)'}`);
  }
  function doEndTurn() {
    const result = endTurn(arena);
    setArena(result.state);
    setLastPlay(`End turn → ${result.events.map((e) => e.type).join(' → ') || '(nothing)'}`);
  }
  function addPersistent(id: string) {
    setArena((a) => applyAll(a, [{ type: 'AddPersistent', target: a.player.id, cardId: cardId(id) }]).state);
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

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={doStartTurn} style={btn('#2980b9', true)} title="Fire clouds, replay minions, run start-of-turn persistents, draw">
                ⏱ Start turn
              </button>
              <button onClick={doEndTurn} style={btn('#2980b9', true)} title="Fog discard + end-of-turn effects">
                ⏹ End turn
              </button>
            </div>

            <label style={{ display: 'grid', gap: 4 }}>
              <span style={labelStyle}>Add a persistent to the player</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) addPersistent(e.target.value);
                }}
                style={inputStyle}
              >
                <option value="">— choose a persistent —</option>
                {PERSISTENT_CARDS.map((p) => (
                  <option key={p.id} value={p.id} title={p.text}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            {lastPlay && (
              <div style={{ fontSize: 12, color: '#888', wordBreak: 'break-word' }}>Last: {lastPlay}</div>
            )}
            <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
              "Play card" and the turn buttons run through the trigger system, so clouds, minions, and
              persistents fire. Watch the resource chips on the combatants.
            </p>

            <TestPanel
              results={testResults}
              hasCard={!!selected}
              userTestCount={userTests.length}
              onCapture={addTestFromArena}
              onDelete={deleteUserTest}
              onExport={exportTests}
            />
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

function TestPanel({
  results,
  hasCard,
  userTestCount,
  onCapture,
  onDelete,
  onExport,
}: {
  results: { test: CardTest; result: CardTestResult; builtin: boolean }[];
  hasCard: boolean;
  userTestCount: number;
  onCapture: () => void;
  onDelete: (test: CardTest) => void;
  onExport: () => void;
}) {
  const passing = results.filter((r) => r.result.ok).length;
  const allPass = results.length > 0 && passing === results.length;

  return (
    <section style={{ borderTop: '1px solid #eee', paddingTop: 12, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Tests</strong>
        {results.length > 0 && (
          <span style={{ fontSize: 12, color: allPass ? '#27ae60' : '#c0392b' }}>
            {passing}/{results.length} passing
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={onExport} disabled={userTestCount === 0} style={btn('#6c5ce7', true)}>
          Export
        </button>
      </div>

      <button onClick={onCapture} disabled={!hasCard} style={btn('#27ae60', true)}>
        + Capture test from arena
      </button>

      {results.length === 0 ? (
        <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
          No tests for this card yet. Configure the arena (HP, resources, targets, then aim) and capture
          the current play as an expected result.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {results.map(({ test, result, builtin }, i) => (
            <li
              key={i}
              style={{
                border: '1px solid #eee',
                borderLeft: `3px solid ${result.ok ? '#27ae60' : '#c0392b'}`,
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: result.ok ? '#27ae60' : '#c0392b' }}>{result.ok ? '✓' : '✗'}</span>
                <span style={{ flex: 1 }}>{test.name}</span>
                {builtin ? (
                  <span style={{ color: '#aaa' }} title="built-in test">
                    built-in
                  </span>
                ) : (
                  <button
                    onClick={() => onDelete(test)}
                    title="Delete test"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#999' }}
                  >
                    ×
                  </button>
                )}
              </div>
              {!result.ok && (
                <div style={{ color: '#c0392b', marginTop: 4 }}>
                  {result.error ??
                    result.failures
                      .map((f) => `${f.field}: expected ${f.expected}, got ${f.actual}`)
                      .join('; ')}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
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
          <pre style={{ margin: 0 }}>
            {JSON.stringify(
              {
                effects: parsed.value.effects,
                ...(parsed.value.triggers.length > 0 ? { triggers: parsed.value.triggers } : {}),
                ...(parsed.value.modifiers.length > 0 ? { modifiers: parsed.value.modifiers } : {}),
              },
              null,
              2,
            )}
          </pre>
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
