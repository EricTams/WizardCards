/**
 * CardTooltip — the hover panel for a card / minion / cloud: its name (and cost),
 * its rules text, and a glossary of the keywords it uses. Presentational only;
 * BattleScreen owns when and where it appears.
 */
import type { KeywordDef } from '@ui/game/keywords';

export interface TipContent {
  readonly title: string;
  readonly cost?: number;
  readonly text?: string;
  readonly keywords: readonly KeywordDef[];
}

export function CardTooltip({ content }: { content: TipContent }) {
  return (
    <div
      style={{
        width: 280,
        background: 'rgba(12,15,22,.97)',
        color: 'white',
        border: '1px solid rgba(255,255,255,.16)',
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 10px 28px rgba(0,0,0,.55)',
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15 }}>
        {content.cost !== undefined && (
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#f2c14a',
              color: '#3a2c06',
              display: 'grid',
              placeItems: 'center',
              fontSize: 13,
              flex: '0 0 auto',
            }}
          >
            {content.cost}
          </span>
        )}
        <span>{content.title}</span>
      </div>

      {content.text && <div style={{ marginTop: 4, fontStyle: 'italic', color: '#e8edf2' }}>{content.text}</div>}

      {content.keywords.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,.12)', paddingTop: 8, display: 'grid', gap: 6 }}>
          {content.keywords.map((k) => (
            <div key={k.term}>
              <span style={{ fontWeight: 700, color: '#f2c14a' }}>{k.term}</span>
              <span style={{ color: '#c8d0d8' }}> — {k.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
