/**
 * EffectsLayer — the play-animation overlay. Purely presentational: it draws the
 * staged (just-played) card in the play area with a text bubble, the projectiles
 * flying from it to their targets, and the floating numbers popping at the
 * targets. BattleScreen owns the timing and feeds it these props.
 */
import type { Anchor } from '@ui/game/effects';
import { sceneAnchor } from '@ui/game/effects';
import { CARD_ART_W, CARD_ART_H } from '@ui/game/art';

export interface Flyer {
  readonly id: number;
  readonly from: Anchor;
  readonly to: Anchor;
  readonly color: string;
  readonly symbol: string;
  readonly durationMs: number;
}

export interface Pop {
  readonly id: number;
  readonly at: Anchor;
  readonly text: string;
  readonly color: string;
}

export interface StagedCard {
  readonly artUrl: string;
  readonly name: string;
  readonly text: string;
  readonly fromSide: 'player' | 'enemy';
}

export const EFFECTS_CSS = `
@keyframes fx-fly { to { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.75); } }
@keyframes fx-pop {
  0% { transform: translate(-50%, -30%) scale(.5); opacity: 0; }
  18% { transform: translate(-50%, -60%) scale(1.15); opacity: 1; }
  100% { transform: translate(-50%, -160%) scale(1); opacity: 0; }
}
@keyframes fx-stage-player { from { transform: translate(-50%, calc(-50% + 90px)) scale(.5); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
@keyframes fx-stage-enemy  { from { transform: translate(-50%, calc(-50% - 90px)) scale(.5); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
`;

export function EffectsLayer({
  staged,
  flyers,
  pops,
  scale = 1.7,
}: {
  staged: StagedCard | null;
  flyers: readonly Flyer[];
  pops: readonly Pop[];
  scale?: number;
}) {
  const card = sceneAnchor('card');
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 8 }}>
      {staged && (
        <div
          style={{
            position: 'fixed',
            left: card.x,
            top: card.y,
            transform: 'translate(-50%, -50%)',
            animation: `${staged.fromSide === 'player' ? 'fx-stage-player' : 'fx-stage-enemy'} 260ms ease-out both`,
            textAlign: 'center',
          }}
        >
          <img
            src={staged.artUrl}
            alt={staged.name}
            draggable={false}
            style={{
              width: CARD_ART_W * scale,
              height: CARD_ART_H * scale,
              imageRendering: 'pixelated',
              borderRadius: 10,
              border: '3px solid #f2c14a',
              boxShadow: '0 10px 30px rgba(0,0,0,.5)',
              background: '#cfe3ea',
            }}
          />
          <div
            style={{
              marginTop: 8,
              display: 'inline-block',
              maxWidth: CARD_ART_W * scale + 60,
              background: 'rgba(15,18,28,.9)',
              color: 'white',
              borderRadius: 8,
              padding: '6px 10px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15 }}>{staged.name}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{staged.text}</div>
          </div>
        </div>
      )}

      {flyers.map((f) => (
        <div
          key={f.id}
          style={
            {
              position: 'fixed',
              left: f.from.x,
              top: f.from.y,
              transform: 'translate(-50%, -50%)',
              animation: `fx-fly ${f.durationMs}ms cubic-bezier(.45,.05,.35,1) forwards`,
              '--dx': `${f.to.x - f.from.x}px`,
              '--dy': `${f.to.y - f.from.y}px`,
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              color: 'white',
              background: `radial-gradient(circle at 50% 40%, ${f.color}, ${f.color}00 72%)`,
              filter: `drop-shadow(0 0 8px ${f.color})`,
            } as React.CSSProperties
          }
        >
          {f.symbol}
        </div>
      ))}

      {pops.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: p.at.x,
            top: p.at.y,
            transform: 'translate(-50%, -50%)',
            animation: 'fx-pop 750ms ease-out forwards',
            fontSize: 30,
            fontWeight: 900,
            color: p.color,
            WebkitTextStroke: '2px rgba(0,0,0,.75)',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {p.text}
        </div>
      ))}
    </div>
  );
}
