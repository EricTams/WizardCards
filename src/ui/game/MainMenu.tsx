/**
 * Main menu — the "game" entry point. For now the game itself is a placeholder;
 * the Card Lab is reachable from here via the hash route '#/cardlab'.
 */
export function MainMenu() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '0 auto', padding: 48, textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, margin: 0 }}>WizardCards</h1>
      <p style={{ color: '#666', marginTop: 8 }}>A deckbuilder with English-authored cards.</p>

      <nav style={{ display: 'grid', gap: 12, maxWidth: 280, margin: '40px auto 0' }}>
        <button
          disabled
          style={{ padding: '12px 16px', font: 'inherit', fontSize: 18, opacity: 0.5, cursor: 'not-allowed' }}
          title="Coming soon"
        >
          Play (coming soon)
        </button>
        <a
          href="#/cardlab"
          style={{
            padding: '12px 16px',
            fontSize: 18,
            textDecoration: 'none',
            color: 'white',
            background: '#6c5ce7',
            borderRadius: 6,
          }}
        >
          Open Card Lab →
        </a>
      </nav>
    </main>
  );
}
