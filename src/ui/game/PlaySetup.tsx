import { useMemo, useState } from 'react';
import { CHARACTERS, RELICS, RELIC_ART, getRelic, type BattleOptions, type PlayableCharacter } from '@cards/index';
import { Sprite } from '@ui/game/Sprite';
import { heroSprite, relicIconUrl, SPRITE_CSS } from '@ui/game/art';
import { BattleScreen } from '@ui/game/BattleScreen';

/**
 * PlaySetup — the light pre-battle flow: pick a character, keep 1 of 3 relics,
 * then drop into the battle. Only characters flagged `playable` are offered.
 */
type PlayChar = PlayableCharacter;

/** The character-specific relic each pick offers alongside two general ones. */
const SIGNATURE_RELIC: Partial<Record<PlayChar, string>> = {
  cloud: 'lightning-rod',
  wizard: 'vial',
  crab: 'seashell',
  writer: 'notebook',
};

export function PlaySetup({ onExit }: { onExit: () => void }) {
  const [character, setCharacter] = useState<PlayChar | null>(null);
  const [options, setOptions] = useState<BattleOptions | null>(null);

  if (options) return <BattleScreen options={options} onExit={onExit} />;

  if (!character) {
    return (
      <SetupShell title="Choose your wanderer" onBack={onExit}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(Object.keys(CHARACTERS) as PlayChar[]).filter((id) => CHARACTERS[id].playable).map((id) => (
            <CharacterCard key={id} id={id} onPick={() => setCharacter(id)} />
          ))}
        </div>
      </SetupShell>
    );
  }

  return (
    <RelicSelect
      character={character}
      onBack={() => setCharacter(null)}
      onExit={onExit}
      onChoose={(relicId) => setOptions({ character, relicId, seed: `${character}-${Date.now()}` })}
    />
  );
}

function CharacterCard({ id, onPick }: { id: PlayChar; onPick: () => void }) {
  const char = CHARACTERS[id];
  const sprite = heroSprite(id, 'idle');
  return (
    <button onClick={onPick} style={pickCard}>
      <style>{SPRITE_CSS}</style>
      {/* Tall enough for the tallest hero sheet (Wizard: 112px × 1.4 = 157). */}
      <div style={{ height: 160, display: 'grid', placeItems: 'center' }}>
        {sprite ? (
          <Sprite sprite={sprite} scale={1.4} />
        ) : (
          <div style={placeholderHero}>{id}</div>
        )}
      </div>
      <h3 style={{ margin: '10px 0 4px' }}>{char.name}</h3>
      <p style={{ margin: 0, color: '#555', fontSize: 13 }}>{char.blurb}</p>
    </button>
  );
}

function RelicSelect({
  character,
  onBack,
  onExit,
  onChoose,
}: {
  character: PlayChar;
  onBack: () => void;
  onExit: () => void;
  onChoose: (relicId: string) => void;
}) {
  // Offer three: the character's signature relic plus general ones to fill out.
  const offered = useMemo(() => {
    const signature = SIGNATURE_RELIC[character];
    const ids = ['old-shield', 'sword', ...(signature ? [signature] : ['calculator'])];
    return ids.map((i) => getRelic(i)).filter((r): r is NonNullable<typeof r> => !!r);
  }, [character]);

  return (
    <SetupShell title="Keep one relic" onBack={onBack} extra={<button onClick={onExit} style={ghostBtn}>Menu</button>}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {offered.map((r) => (
          <button key={r.id} onClick={() => onChoose(r.id)} style={pickCard}>
            <div style={{ height: 96, display: 'grid', placeItems: 'center' }}>
              {RELIC_ART.has(r.name) ? (
                <img
                  src={relicIconUrl(r.name)}
                  alt={r.name}
                  width={96}
                  height={96}
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div style={{ fontSize: 48 }}>🔮</div>
              )}
            </div>
            <h3 style={{ margin: '10px 0 4px' }}>{r.name}</h3>
            <p style={{ margin: 0, color: '#555', fontSize: 13 }}>{r.text}</p>
          </button>
        ))}
      </div>
      <p style={{ textAlign: 'center', color: '#888', fontSize: 13, marginTop: 20 }}>
        Playing <strong>{CHARACTERS[character].name}</strong> · {RELICS.length} relics exist; three are offered.
      </p>
    </SetupShell>
  );
}

function SetupShell({
  title,
  onBack,
  extra,
  children,
}: {
  title: string;
  onBack: () => void;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 820, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={ghostBtn}>
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        <span style={{ flex: 1 }} />
        {extra}
      </div>
      {children}
    </main>
  );
}

const pickCard: React.CSSProperties = {
  font: 'inherit',
  width: 240,
  padding: 20,
  textAlign: 'center',
  background: 'white',
  border: '2px solid #ddd',
  borderRadius: 12,
  cursor: 'pointer',
  boxShadow: '0 3px 10px rgba(0,0,0,.06)',
};

const placeholderHero: React.CSSProperties = {
  width: 130,
  height: 130,
  display: 'grid',
  placeItems: 'center',
  background: '#efeafd',
  border: '3px solid #6c5ce7',
  borderRadius: 10,
  color: '#6c5ce7',
  fontWeight: 800,
  fontSize: 18,
  textTransform: 'capitalize',
};

const ghostBtn: React.CSSProperties = {
  font: 'inherit',
  fontWeight: 600,
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid #6c5ce7',
  background: 'white',
  color: '#6c5ce7',
  cursor: 'pointer',
};
