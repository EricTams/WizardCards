import { useCallback, useEffect, useRef, useState } from 'react';
import {
  newBattle,
  confirmMulligan,
  randomMatchup,
  playFromHand,
  endPlayerPhase,
  beginEnemyTurn,
  enemyPlayOne,
  aiPlayOne,
  beginPlayerTurn,
  getCard,
  applyWithTriggers,
  CHARACTERS,
  OPENING_DISCARD,
  CLOUD_CAP,
  PLAYER_ID,
  ENEMY_ID,
  type BattleOptions,
} from '@cards/index';
import type { Combatant, GameEvent, GameState, MinionState } from '@engine/index';
import type { CardId, CloudType, EntityId } from '@shared/index';
import { Sprite } from '@ui/game/Sprite';
import { heroSprite, cloudSprite, cardArtUrl, CARD_ART_W, CARD_ART_H, SPRITE_CSS, CARD_POINTER } from '@ui/game/art';
import { describeEvents, nameMap, type LogEntry, type LogSide } from '@ui/game/combatLog';
import { impactsFromEvents, impactAnchor, sceneAnchor } from '@ui/game/effects';
import { EffectsLayer, EFFECTS_CSS, type Flyer, type Pop, type StagedCard } from '@ui/game/EffectsLayer';
import { keywordsInText } from '@ui/game/keywords';
import { CardTooltip, type TipContent } from '@ui/game/CardTooltip';

/**
 * BattleScreen — the playable game view (see `reference/screen mockups`). A themed
 * full-screen scene: your hero + clouds bottom-left, the opponent top-right, and a
 * fanned hand of card art along the bottom. Every *number* (HP, energy, block, …)
 * is a plain HTML element; only heroes, clouds, and cards are art. It reads the
 * `GameState` and drives it through the battle driver in the cards layer.
 */
export interface BattleScreenProps {
  readonly options: BattleOptions;
  readonly onExit: () => void;
  /** Attract Mode: both sides are AI, the match auto-plays and loops. No input. */
  readonly auto?: boolean;
}

/** The enemy pauses this long before starting its turn. */
const TURN_START_DELAY_MS = 3000;

// Play-animation beats: card rises → projectiles fly → impact (state applies +
// numbers pop) → hold. These also pace the AI turns (one play ≈ RISE+FLY+POP).
const RISE_MS = 300;
const FLY_MS = 440;
const POP_MS = 720;

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** The badge on the opponent's face-down hand, by character. */
const CHARACTER_EMBLEM: Record<string, string> = {
  cloud: '☁',
  wizard: '🔮',
  crab: '🦀',
};

const THEME_BG: Record<string, string> = {
  field: 'linear-gradient(to bottom, #7fc3ff 0%, #7fc3ff 30%, #5aa84a 30%, #4f9a41 100%)',
  chamber: 'linear-gradient(to bottom, #2d2260 0%, #2d2260 28%, #6b62c6 28%, #5a51b0 100%)',
  beach: 'linear-gradient(to bottom, #4a90c2 0%, #4a90c2 24%, #e3b476 24%, #d6a463 100%)',
};

export function BattleScreen({ options, onExit, auto = false }: BattleScreenProps) {
  const character = CHARACTERS[options.character];
  const [state, setState] = useState<GameState>(() => newBattle(options));
  const [mullPicks, setMullPicks] = useState<number[]>([]);
  const [log, setLog] = useState<string>(auto ? 'Attract Mode' : 'Your move.');
  const [enemyActing, setEnemyActing] = useState(false);

  // Combat log: a scrolling, human-readable record of how each play resolved,
  // built from the engine's event stream. Capped so Attract Mode can loop forever.
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const nextLogId = useRef(0);
  const pushLog = useCallback((title: string, lines: readonly string[], side: LogSide) => {
    setLogEntries((prev) => {
      const next = [...prev, { id: nextLogId.current++, title, lines, side }];
      return next.length > 40 ? next.slice(next.length - 40) : next;
    });
  }, []);
  const logPlay = useCallback(
    (s: GameState, actorId: EntityId, cardId: CardId, events: readonly GameEvent[]) => {
      const nm = nameMap(s);
      const name = getCard(cardId)?.name ?? 'a card';
      pushLog(
        `${nm[actorId] ?? 'Someone'} plays ${name}`,
        describeEvents(events, nm, { skipCardId: cardId }),
        actorId === PLAYER_ID ? 'player' : 'enemy',
      );
    },
    [pushLog],
  );
  const logTurn = useCallback(
    (s: GameState, title: string, events: readonly GameEvent[], side: LogSide) => {
      pushLog(title, describeEvents(events, nameMap(s)), side);
    },
    [pushLog],
  );
  // Like logTurn, but skips the entry entirely when nothing happened (avoids a
  // bare "ends turn" header when there were no end-of-turn effects).
  const logTurnIfAny = useCallback(
    (s: GameState, title: string, events: readonly GameEvent[], side: LogSide) => {
      const lines = describeEvents(events, nameMap(s));
      if (lines.length) pushLog(title, lines, side);
    },
    [pushLog],
  );

  // Play animation: the staged card, in-flight projectiles, and floating numbers.
  const [staged, setStaged] = useState<StagedCard | null>(null);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [targeting, setTargeting] = useState<number | null>(null); // hand index awaiting a target pick
  const fxId = useRef(0);
  const animating = staged !== null;

  // Hover tooltip (cards / minions / clouds): card text + keyword explanations.
  const [tip, setTip] = useState<{ content: TipContent; x: number; y: number; above: boolean } | null>(null);
  const showTip = useCallback((content: TipContent, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const above = r.top > 240; // room above? else drop below (for top-of-screen elements)
    setTip({ content, x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);
  const hoverCard = useCallback(
    (cardId: CardId, el: HTMLElement) => {
      const c = getCard(cardId);
      if (c) showTip({ title: c.name, cost: c.cost, text: c.text, keywords: keywordsInText(c.text) }, el);
    },
    [showTip],
  );
  const hoverCloud = useCallback(
    (type: CloudType, el: HTMLElement) => {
      showTip({ title: `${type[0]!.toUpperCase()}${type.slice(1)} Cloud`, keywords: keywordsInText(type) }, el);
    },
    [showTip],
  );

  // Guards the paced sequences against setState-after-unmount.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Animate one card play and apply its result at the moment of impact: stage the
   * card in the play area (with its text) → fly a projectile per outgoing effect →
   * apply the new state, log it, and pop the numbers at the targets → clear.
   * `onApply` fires exactly when the state is applied (used to un-hide the hand).
   */
  const animateAndApply = useCallback(
    async (
      actorId: EntityId,
      cardId: CardId,
      events: readonly GameEvent[],
      after: GameState,
      onApply?: () => void,
    ) => {
      const card = getCard(cardId);
      const actorSide: 'player' | 'enemy' = actorId === PLAYER_ID ? 'player' : 'enemy';
      setStaged({ artUrl: card ? cardArtUrl(card) : '', name: card?.name ?? 'Card', text: card?.text ?? '', fromSide: actorSide });
      await delay(RISE_MS);
      if (!mounted.current) return;

      const impacts = impactsFromEvents(events, actorId);
      const from = sceneAnchor('card');
      const flyList: Flyer[] = impacts
        .filter((im) => im.fly)
        .map((im) => ({ id: fxId.current++, from, to: impactAnchor(actorSide, im.side), color: im.color, symbol: im.symbol, durationMs: FLY_MS }));
      if (flyList.length) setFlyers(flyList);
      await delay(flyList.length ? FLY_MS : 100);
      if (!mounted.current) return;

      // Impact: apply the new state (bars move), log it, pop the numbers.
      setFlyers([]);
      setState(after);
      onApply?.();
      logPlay(after, actorId, cardId, events);
      const perSide: Record<string, number> = {};
      setPops(
        impacts.map((im) => {
          const a = impactAnchor(actorSide, im.side);
          const n = (perSide[im.side] = (perSide[im.side] ?? 0) + 1) - 1;
          return { id: fxId.current++, at: { x: a.x, y: a.y - n * 32 }, text: im.text, color: im.color };
        }),
      );
      await delay(POP_MS);
      if (!mounted.current) return;
      setPops([]);
      setStaged(null);
    },
    [logPlay],
  );

  // Attract Mode conductor: drive an AI-vs-AI match to completion, on a watchable
  // clock, and loop forever. Runs once; threads a local `cur` state through the
  // decomposed battle steps so it never reads stale React state.
  const attractStarted = useRef(false);
  const attractRound = useRef(0);
  useEffect(() => {
    if (!auto || attractStarted.current) return;
    attractStarted.current = true;

    const done = (s: GameState) => s.phase === 'won' || s.phase === 'lost';
    const cardName = (id: CardId) => getCard(id)?.name ?? 'a card';

    const playOut = async (start: GameState, actorId: EntityId, name: string): Promise<GameState> => {
      let cur = start;
      while (mounted.current) {
        const play = aiPlayOne(cur, actorId);
        if (!play) break;
        cur = play.state;
        setLog(`${name} plays ${cardName(play.cardId)}.`);
        await animateAndApply(actorId, play.cardId, play.events, cur);
        if (done(cur)) break;
        if (!mounted.current) break;
      }
      return cur;
    };

    // Each round re-rolls the matchup from that round's seed, so the demo cycles
    // through pairings instead of replaying one forever. Deriving it from the
    // seed (rather than Math.random) keeps any given round reproducible.
    const openBattle = (seed: string | number): GameState => {
      const r = confirmMulligan(newBattle({ ...options, seed, ...randomMatchup(seed) }), [0, 1]);
      setLogEntries([]);
      setState(r.state);
      logTurn(r.state, `— ${r.state.player.name} vs ${r.state.enemies[0]?.name ?? 'Enemy'} —`, r.events, 'player');
      return r.state;
    };

    (async () => {
      let cur = openBattle(options.seed);
      while (mounted.current) {
        if (done(cur)) {
          const winner = cur.phase === 'won' ? cur.player.name : cur.enemies[0]?.name ?? 'Enemy';
          pushLog(`🏆 ${winner} wins!`, [], 'neutral');
          setLog(`${winner} wins! Restarting…`);
          await delay(4000);
          if (!mounted.current) return;
          attractRound.current += 1;
          cur = openBattle(`${options.seed}-${attractRound.current}`);
          continue;
        }
        if (cur.phase === 'playerTurn') {
          setLog(`${cur.player.name}'s turn.`);
          await delay(TURN_START_DELAY_MS);
          if (!mounted.current) return;
          cur = await playOut(cur, PLAYER_ID, cur.player.name);
          if (cur.phase === 'playerTurn') {
            const e = endPlayerPhase(cur);
            cur = e.state;
            setState(cur);
            logTurnIfAny(cur, `${cur.player.name} ends turn`, e.events, 'player');
          }
        } else if (cur.phase === 'enemyTurn') {
          const ename = cur.enemies[0]?.name ?? 'Enemy';
          setLog(`${ename}'s turn.`);
          await delay(TURN_START_DELAY_MS);
          if (!mounted.current) return;
          const b = beginEnemyTurn(cur);
          cur = b.state;
          setState(cur);
          logTurn(cur, `— ${ename}'s turn —`, b.events, 'enemy');
          cur = await playOut(cur, ENEMY_ID, ename);
          if (cur.phase === 'enemyTurn') {
            const p = beginPlayerTurn(cur);
            cur = p.state;
            setState(cur);
            logTurn(cur, `— ${cur.player.name}'s turn —`, p.events, 'player');
          }
        } else {
          break;
        }
      }
    })();
  }, [auto, options, logTurn, logTurnIfAny, pushLog, animateAndApply]);

  const player = state.player;
  const enemy = state.enemies[0];
  const isPlayerTurn = !auto && state.phase === 'playerTurn' && !enemyActing && !animating;
  const decided = state.phase === 'won' || state.phase === 'lost';
  // Over the cloud cap: the player must replace clouds (one at a time) before
  // doing anything else.
  const overCap = isPlayerTurn && targeting === null && player.clouds.length > CLOUD_CAP;

  function removeCloudAt(index: number) {
    const r = applyWithTriggers(state, { type: 'RemoveCloudAt', target: PLAYER_ID, index });
    setState(r.state);
    setLog(r.state.player.clouds.length > CLOUD_CAP ? 'Replace another cloud…' : 'Clouds set.');
  }

  // Follow whoever is actually in the battle, not the character in `options` —
  // Attract Mode re-rolls the matchup each round, so the two can differ.
  const sceneChar = (state.player.character && CHARACTERS[state.player.character as keyof typeof CHARACTERS]) || character;
  const bg = THEME_BG[sceneChar.theme] ?? THEME_BG.field;

  function toggleMull(i: number) {
    setMullPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < OPENING_DISCARD ? [...p, i] : p));
  }
  function doMulligan() {
    if (mullPicks.length !== OPENING_DISCARD) return;
    const r = confirmMulligan(state, mullPicks);
    setState(r.state);
    setMullPicks([]);
    setLog('Turn 1 — play a card.');
    logTurn(r.state, `— ${r.state.player.name}'s turn —`, r.events, 'player');
  }
  function playCardAt(index: number) {
    if (!isPlayerTurn || overCap || !enemy) return;
    const cardId = player.hand[index]!;
    const card = getCard(cardId);
    if (!card || player.energy < card.cost) {
      setLog(`Not enough energy for ${card?.name ?? 'that'}.`);
      return;
    }
    // If the card attacks and the enemy has minions (decoys), let the player pick
    // which to hit; otherwise just aim at the enemy hero.
    if (enemy.minions.length > 0 && /\bdeal\b|venom/i.test(card.text)) {
      setTargeting(index);
      setLog(`Choose a target for ${card.name}.`);
      return;
    }
    void resolvePlay(index, ENEMY_ID);
  }
  async function resolvePlay(index: number, targetId: EntityId) {
    if (!isPlayerTurn) return;
    const cardId = player.hand[index]!;
    const card = getCard(cardId);
    if (!card) return;
    const r = playFromHand(state, PLAYER_ID, index, targetId);
    setTargeting(null);
    setPlayingIndex(index); // hide the played card in hand while it's staged
    setLog(`You play ${card.name}.`);
    await animateAndApply(PLAYER_ID, cardId, r.events, r.state, () => setPlayingIndex(null));
  }
  /**
   * End the player's turn, then run the enemy's turn at a watchable pace: 3s
   * before it starts, then it plays a random valid card every 1s until it has no
   * legal play left. Each step advances the same battle driver the tests use.
   */
  async function doEndTurn() {
    if (!isPlayerTurn) return;
    const ename = enemy?.name ?? 'The enemy';
    const ended = endPlayerPhase(state);
    setState(ended.state);
    logTurnIfAny(ended.state, `${ended.state.player.name} ends turn`, ended.events, 'player');
    if (ended.state.phase === 'won' || ended.state.phase === 'lost') {
      setLog('Battle over.');
      return;
    }

    setEnemyActing(true);
    setLog(`${ename} is thinking…`);
    await delay(TURN_START_DELAY_MS);
    if (!mounted.current) return;

    const begin = beginEnemyTurn(ended.state);
    let cur = begin.state;
    setState(cur);
    setLog(`${ename}'s turn.`);
    logTurn(cur, `— ${ename}'s turn —`, begin.events, 'enemy');

    while (cur.phase === 'enemyTurn') {
      const play = enemyPlayOne(cur);
      if (!play) break;
      cur = play.state;
      setLog(`${ename} plays ${getCard(play.cardId)?.name ?? 'a card'}.`);
      await animateAndApply(ENEMY_ID, play.cardId, play.events, cur);
      if (cur.phase !== 'enemyTurn') break; // player was defeated
      if (!mounted.current) return;
    }

    if (cur.phase === 'enemyTurn') {
      const begun = beginPlayerTurn(cur);
      cur = begun.state;
      setState(cur);
      setLog('Your turn — play a card.');
      logTurn(cur, `— ${cur.player.name}'s turn —`, begun.events, 'player');
    }
    setEnemyActing(false);
  }
  function restart() {
    setState(newBattle({ ...options, seed: `${options.seed}-${Date.now()}` }));
    setMullPicks([]);
    setLogEntries([]);
    setLog('New battle — discard 2 to begin.');
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: bg,
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <style>{SPRITE_CSS + FLOAT_CSS + EFFECTS_CSS}</style>

      {/* Top HUD: exit + turn + log */}
      <div style={{ position: 'absolute', top: 10, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 12, zIndex: 5 }}>
        <button onClick={onExit} style={hudBtn}>
          ← Menu
        </button>
        {auto && <span style={{ ...pill, background: '#c0392b', letterSpacing: 1 }}>● ATTRACT MODE</span>}
        <span style={{ ...pill, background: 'rgba(0,0,0,.55)' }}>Turn {Math.max(1, state.turn)}</span>
        <span style={{ ...pill, background: 'rgba(0,0,0,.4)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log}
        </span>
      </div>

      {/* Combat log — how each play resolved, top-left */}
      <CombatLog entries={logEntries} />

      {/* Opponent's hidden hand — a fan of card backs, top-center (mirrors yours) */}
      {enemy && <OpponentHand count={enemy.hand.length} emblem={CHARACTER_EMBLEM[enemy.character ?? ''] ?? '☁'} />}

      {/* Enemy — top right */}
      {enemy && (
        <div style={{ position: 'absolute', top: '16%', right: '6%', textAlign: 'center' }}>
          <CombatantBadges c={enemy} align="right" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-end', marginTop: 6 }}>
            <MinionRow
              minions={enemy.minions}
              onHover={hoverCard}
              onLeave={hideTip}
              targetable={targeting !== null}
              onTarget={(id) => targeting !== null && void resolvePlay(targeting, id)}
            />
            <CloudRow clouds={enemy.clouds} onHover={hoverCloud} onLeave={hideTip} />
            <div
              onClick={targeting !== null ? () => void resolvePlay(targeting, ENEMY_ID) : undefined}
              style={{
                cursor: targeting !== null ? 'crosshair' : 'default',
                outline: targeting !== null ? '3px solid #f2c14a' : 'none',
                borderRadius: 10,
              }}
            >
              <HeroUnit c={enemy} flip />
            </div>
          </div>
          <div style={{ ...tinyNote, marginTop: 4 }}>{enemy.drawPile.length} in deck</div>
        </div>
      )}

      {/* Player — bottom left, above the hand */}
      <div style={{ position: 'absolute', left: '6%', bottom: 230, textAlign: 'center' }}>
        <CombatantBadges c={player} align="left" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 6 }}>
          <HeroUnit c={player} />
          <CloudRow
            clouds={player.clouds}
            onHover={hoverCloud}
            onLeave={hideTip}
            removable={overCap}
            onRemove={removeCloudAt}
          />
          <MinionRow minions={player.minions} onHover={hoverCard} onLeave={hideTip} />
        </div>
      </div>

      {/* Energy indicator near the player. During the opening (before the turn
          formally starts) preview the energy you'll begin turn 1 with, including
          each Lightning cloud's +1 — otherwise a Lightning-Rod cloud shows no
          benefit until you commit the mulligan. */}
      {!decided && (
        <div style={{ position: 'absolute', left: '6%', bottom: 196, display: 'flex', gap: 6, alignItems: 'center' }}>
          <EnergyPips
            energy={
              state.phase === 'mulligan'
                ? player.energy + player.clouds.filter((c) => c === 'lightning').length
                : player.energy
            }
          />
        </div>
      )}

      {/* Hand */}
      <Hand
        hand={player.hand}
        energy={player.energy}
        phase={state.phase}
        mullPicks={mullPicks}
        locked={auto || animating}
        hideIndex={playingIndex}
        onCard={(i) => (auto ? undefined : state.phase === 'mulligan' ? toggleMull(i) : playCardAt(i))}
        onHoverCard={hoverCard}
        onLeaveCard={hideTip}
      />

      {/* Turn / mulligan controls (hidden in Attract Mode) */}
      <div style={{ position: 'absolute', right: 20, bottom: 96, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', zIndex: 6 }}>
        {!auto && state.phase === 'mulligan' && (
          <>
            <span style={{ ...pill, background: 'rgba(0,0,0,.6)' }}>Discard {OPENING_DISCARD} to open ({mullPicks.length}/{OPENING_DISCARD})</span>
            <button onClick={doMulligan} disabled={mullPicks.length !== OPENING_DISCARD} style={bigBtn(mullPicks.length === OPENING_DISCARD)}>
              Start battle
            </button>
          </>
        )}
        {isPlayerTurn && !overCap && targeting === null && (
          <button onClick={doEndTurn} style={bigBtn(true)}>
            End turn ▶
          </button>
        )}
      </div>

      {/* Play animations: staged card, projectiles, floating numbers */}
      <EffectsLayer staged={staged} flyers={flyers} pops={pops} />

      {/* Cloud-cap prompt: choose which clouds to replace, one at a time */}
      {overCap && (
        <div
          style={{
            position: 'absolute',
            left: '6%',
            bottom: 360,
            zIndex: 9,
          }}
        >
          <span style={{ ...pill, background: 'rgba(0,0,0,.72)' }}>
            ☁ Cloud limit is {CLOUD_CAP} — click a cloud to replace ({player.clouds.length - CLOUD_CAP} over)
          </span>
        </div>
      )}

      {/* Targeting prompt (only when the enemy has minions to pick between) */}
      {targeting !== null && (
        <div
          style={{
            position: 'absolute',
            top: '44%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            zIndex: 9,
          }}
        >
          <span style={{ ...pill, background: 'rgba(0,0,0,.7)' }}>🎯 Click a target (hero or a minion)</span>
          <button onClick={() => setTargeting(null)} style={{ ...hudBtn, background: 'rgba(0,0,0,.6)' }}>
            Cancel
          </button>
        </div>
      )}

      {/* Hover tooltip: card/minion/cloud text + keyword glossary */}
      {tip && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(Math.max(tip.x, 150), window.innerWidth - 150),
            top: tip.y,
            transform: `translate(-50%, ${tip.above ? '-100%' : '0'})`,
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          <CardTooltip content={tip.content} />
        </div>
      )}

      {decided && !auto && <Outcome won={state.phase === 'won'} onRestart={restart} onExit={onExit} />}
    </div>
  );
}

/** A hero sprite, or a labelled placeholder box for characters without art yet. */
function HeroUnit({ c, flip = false }: { c: Combatant; flip?: boolean }) {
  const dead = c.hp <= 0;
  const sprite = heroSprite(c.character, dead ? 'die' : 'idle');
  if (sprite) {
    return <Sprite sprite={sprite} scale={2} animate={!dead} flip={flip} title={c.name} />;
  }
  return (
    <div
      title={c.name}
      style={{
        width: 150,
        height: 150,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(255,255,255,.9)',
        border: '3px solid #2c3e50',
        borderRadius: 10,
        color: '#2c3e50',
        fontWeight: 800,
        fontSize: 18,
        opacity: dead ? 0.4 : 1,
        textTransform: 'capitalize',
      }}
    >
      {c.character ?? c.name}
    </div>
  );
}

const SIDE_COLOR: Record<LogSide, string> = { player: '#7fd0ff', enemy: '#ff9a8b', neutral: '#f4d35e' };

/** Scrolling combat log — a titled block per card play / turn, effects beneath. */
function CombatLog({ entries }: { entries: readonly LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);
  if (entries.length === 0) return null;
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: 12,
        top: 50,
        width: 288,
        maxHeight: 258,
        overflowY: 'auto',
        background: 'rgba(15,18,28,.72)',
        border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 8,
        padding: '8px 10px',
        zIndex: 5,
        backdropFilter: 'blur(2px)',
      }}
    >
      {entries.map((e) => (
        <div key={e.id} style={{ marginBottom: 6 }}>
          <div style={{ color: SIDE_COLOR[e.side], fontWeight: 700, fontSize: 12 }}>{e.title}</div>
          {e.lines.map((l, i) => (
            <div key={i} style={{ color: '#dfe4ea', fontSize: 12, paddingLeft: 10, lineHeight: 1.35 }}>
              • {l}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A single face-down card — a "fake" back used for the opponent's hidden hand. */
function CardBack({ w = 50, emblem = '✦' }: { w?: number; emblem?: string }) {
  const h = w * 1.5;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        border: '2px solid #0e1119',
        background: 'repeating-linear-gradient(45deg, #3a4a8c 0 6px, #2c3a70 6px 12px)',
        boxShadow: '0 3px 8px rgba(0,0,0,.4)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 4,
          border: '1px solid rgba(255,255,255,.28)',
          borderRadius: 4,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span style={{ fontSize: w * 0.5, opacity: 0.85 }}>{emblem}</span>
      </div>
    </div>
  );
}

/** The opponent's hand as a fan of face-down card backs (top-center, hanging down). */
function OpponentHand({ count, emblem }: { count: number; emblem: string }) {
  const shown = Math.min(Math.max(0, count), 10);
  if (shown === 0) return null;
  const mid = (shown - 1) / 2;
  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'flex-start',
        zIndex: 3,
      }}
      title={`${count} cards in hand`}
    >
      {Array.from({ length: shown }, (_, i) => {
        const off = i - mid;
        return (
          <div
            key={i}
            style={{
              marginLeft: i === 0 ? 0 : -18,
              transform: `translateY(${Math.abs(off) * 2.5}px) rotate(${off * 4}deg)`,
              transformOrigin: 'top center',
            }}
          >
            <CardBack emblem={emblem} />
          </div>
        );
      })}
    </div>
  );
}

/** A row of minion tokens — hoverable (tooltip) and, when `targetable`, clickable. */
function MinionRow({
  minions,
  onHover,
  onLeave,
  targetable = false,
  onTarget,
}: {
  minions: readonly MinionState[];
  onHover: (cardId: CardId, el: HTMLElement) => void;
  onLeave: () => void;
  targetable?: boolean;
  onTarget?: (id: EntityId) => void;
}) {
  if (minions.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {minions.map((m) => (
        <div
          key={m.id}
          style={{
            ...minionBox,
            cursor: targetable ? 'crosshair' : 'help',
            outline: targetable ? '3px solid #f2c14a' : 'none',
            boxShadow: targetable ? '0 0 10px #f2c14a' : minionBox.boxShadow,
          }}
          onMouseEnter={(e) => onHover(m.cardId, e.currentTarget)}
          onMouseLeave={onLeave}
          onClick={targetable && onTarget ? () => onTarget(m.id) : undefined}
        >
          M
        </div>
      ))}
    </div>
  );
}

function CloudRow({
  clouds,
  onHover,
  onLeave,
  removable = false,
  onRemove,
}: {
  clouds: readonly CloudType[];
  onHover?: (type: CloudType, el: HTMLElement) => void;
  onLeave?: () => void;
  removable?: boolean;
  onRemove?: (index: number) => void;
}) {
  if (clouds.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
      {clouds.map((t, i) => (
        <div
          key={i}
          style={{
            animation: `bob 2.4s ease-in-out ${i * 0.2}s infinite`,
            cursor: removable ? 'crosshair' : 'help',
            outline: removable ? '3px solid #f2c14a' : 'none',
            borderRadius: 6,
          }}
          onMouseEnter={onHover ? (e) => onHover(t, e.currentTarget) : undefined}
          onMouseLeave={onLeave}
          onClick={removable && onRemove ? () => onRemove(i) : undefined}
        >
          <Sprite sprite={cloudSprite(t)} scale={1.4} />
        </div>
      ))}
    </div>
  );
}

/** HP bar + resource chips. All numeric UI, so all HTML — never art. */
function CombatantBadges({ c, align }: { c: Combatant; align: 'left' | 'right' }) {
  const pct = c.maxHp > 0 ? Math.max(0, (c.hp / c.maxHp) * 100) : 0;
  const chips: string[] = [];
  if (c.block > 0) chips.push(`🛡 ${c.block}`);
  if (c.shield > 0) chips.push(`◆ ${c.shield}`);
  if (c.poison > 0) chips.push(`☠ ${c.poison}`);
  if (c.power > 0) chips.push(`💪 ${c.power}`);
  if (c.bravery > 0) chips.push(`✒ ${c.bravery}`);
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: align === 'right' ? 'flex-end' : 'flex-start', minWidth: 160 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'white', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>
        <span>{c.name}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          ❤ {Math.max(0, c.hp)}/{c.maxHp}
        </span>
      </div>
      <div style={{ width: 160, height: 12, background: 'rgba(0,0,0,.4)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(0,0,0,.5)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct > 30 ? '#e34b4b' : '#b02a2a', transition: 'width 200ms' }} />
      </div>
      {chips.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          {chips.map((c2, i) => (
            <span key={i} style={statChip}>
              {c2}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EnergyPips({ energy }: { energy: number }) {
  const shown = Math.min(energy, 8);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} style={{ fontSize: 20, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.6))' }}>
          ⚡
        </span>
      ))}
      <span style={{ ...pill, background: 'rgba(0,0,0,.55)' }}>{energy} energy</span>
    </div>
  );
}

function Hand({
  hand,
  energy,
  phase,
  mullPicks,
  locked = false,
  hideIndex = null,
  onCard,
  onHoverCard,
  onLeaveCard,
}: {
  hand: readonly CardId[];
  energy: number;
  phase: GameState['phase'];
  mullPicks: number[];
  locked?: boolean;
  hideIndex?: number | null;
  onCard: (i: number) => void;
  onHoverCard?: (cardId: CardId, el: HTMLElement) => void;
  onLeaveCard?: () => void;
}) {
  const interactive = !locked && (phase === 'playerTurn' || phase === 'mulligan');
  // The cards overlap in the fan, so the hand points at whichever one a click
  // would actually land on.
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div
      onMouseLeave={() => setHovered(null)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 8,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 0,
        zIndex: 4,
        // Always allow pointer events so cards can be hovered for their tooltip;
        // clicking to play is still gated by `interactive` below.
        pointerEvents: 'auto',
      }}
    >
      {hand.map((id, i) => {
        const card = getCard(id);
        const picked = mullPicks.includes(i);
        const affordable = phase !== 'playerTurn' || (card ? energy >= card.cost : false);
        return (
          <HandCard
            key={`${id}-${i}`}
            name={card?.name ?? id}
            cost={card?.cost ?? 0}
            artUrl={card ? cardArtUrl(card) : ''}
            index={i}
            count={hand.length}
            picked={picked}
            dimmed={!affordable}
            hidden={i === hideIndex}
            pointed={interactive && i === hovered && i !== hideIndex}
            onClick={() => interactive && onCard(i)}
            onHover={(el) => {
              setHovered(i);
              onHoverCard?.(id, el);
            }}
            onLeave={() => onLeaveCard?.()}
          />
        );
      })}
    </div>
  );
}

function HandCard({
  name,
  cost,
  artUrl,
  index,
  count,
  picked,
  dimmed,
  hidden = false,
  pointed = false,
  onClick,
  onHover,
  onLeave,
}: {
  name: string;
  cost: number;
  artUrl: string;
  index: number;
  count: number;
  picked: boolean;
  dimmed: boolean;
  hidden?: boolean;
  /** The cursor is over this card — show the pointing hand above it. */
  pointed?: boolean;
  onClick: () => void;
  onHover?: (el: HTMLElement) => void;
  onLeave?: () => void;
}) {
  const mid = (count - 1) / 2;
  const offset = index - mid;
  const rotate = offset * 3;
  const lift = Math.abs(offset) * 6;
  const scale = 1.5;
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover ? (e) => onHover(e.currentTarget) : undefined}
      onMouseLeave={onLeave}
      className="handcard"
      style={{
        width: CARD_ART_W * scale,
        height: CARD_ART_H * scale,
        marginLeft: index === 0 ? 0 : -28,
        transform: `translateY(${picked ? -40 : lift}px) rotate(${rotate}deg)`,
        transformOrigin: 'bottom center',
        transition: 'transform 120ms ease',
        cursor: 'pointer',
        position: 'relative',
        // Lift above the neighbouring cards so the pointer isn't clipped by them.
        zIndex: pointed ? 1 : undefined,
        visibility: hidden ? 'hidden' : 'visible',
        filter: dimmed ? 'grayscale(.6) brightness(.8)' : 'none',
      }}
    >
      {pointed && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 4,
            pointerEvents: 'none',
          }}
        >
          <Sprite sprite={CARD_POINTER} scale={2} animate={false} />
        </div>
      )}
      <img
        src={artUrl}
        alt={name}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          borderRadius: 8,
          border: picked ? '3px solid #e8c14a' : '2px solid rgba(0,0,0,.5)',
          boxShadow: '0 6px 12px rgba(0,0,0,.35)',
          background: '#cfe3ea',
        }}
      />
      <span style={costBadge}>{cost}</span>
      <span style={cardNameTag}>{name}</span>
    </div>
  );
}

function Outcome({ won, onRestart, onExit }: { won: boolean; onRestart: () => void; onExit: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,.6)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 10,
      }}
    >
      <div style={{ background: 'white', borderRadius: 14, padding: '28px 36px', textAlign: 'center', minWidth: 280 }}>
        <div style={{ fontSize: 52 }}>{won ? '🏆' : '💀'}</div>
        <h2 style={{ margin: '8px 0 4px', color: won ? '#2e7d32' : '#b02a2a' }}>{won ? 'Victory!' : 'Defeated'}</h2>
        <p style={{ color: '#666', marginTop: 0 }}>{won ? 'You bested the Rival Cloud.' : 'The Rival Cloud got the better of you.'}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={onRestart} style={bigBtn(true)}>
            Play again
          </button>
          <button onClick={onExit} style={{ ...bigBtn(false), background: 'white', color: '#6c5ce7' }}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- styles ----------------------------------------------------------------

const FLOAT_CSS = `
@keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
.handcard:hover { transform: translateY(-44px) rotate(0deg) !important; z-index: 20; }
`;

const pill: React.CSSProperties = {
  color: 'white',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const hudBtn: React.CSSProperties = {
  font: 'inherit',
  fontWeight: 600,
  padding: '4px 12px',
  borderRadius: 6,
  border: 'none',
  background: 'rgba(0,0,0,.55)',
  color: 'white',
  cursor: 'pointer',
};

const tinyNote: React.CSSProperties = {
  color: 'white',
  fontSize: 11,
  opacity: 0.85,
  textShadow: '0 1px 2px rgba(0,0,0,.6)',
};

const statChip: React.CSSProperties = {
  background: 'rgba(0,0,0,.55)',
  color: 'white',
  borderRadius: 5,
  padding: '1px 6px',
  fontSize: 12,
  fontWeight: 600,
};

const minionBox: React.CSSProperties = {
  width: 34,
  height: 44,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(120,190,90,.95)',
  border: '2px solid #2c3e50',
  borderRadius: 5,
  color: '#20351a',
  fontWeight: 800,
};

const costBadge: React.CSSProperties = {
  position: 'absolute',
  top: -8,
  left: -8,
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: '#f2c14a',
  border: '2px solid #7a5c12',
  color: '#3a2c06',
  display: 'grid',
  placeItems: 'center',
  fontWeight: 800,
  fontSize: 15,
  boxShadow: '0 2px 4px rgba(0,0,0,.4)',
};

const cardNameTag: React.CSSProperties = {
  position: 'absolute',
  bottom: 6,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0,0,0,.72)',
  color: 'white',
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 4,
  whiteSpace: 'nowrap',
  maxWidth: '90%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function bigBtn(enabled: boolean): React.CSSProperties {
  return {
    font: 'inherit',
    fontWeight: 700,
    fontSize: 16,
    padding: '10px 18px',
    borderRadius: 8,
    border: 'none',
    background: enabled ? '#6c5ce7' : '#9992c9',
    color: 'white',
    cursor: enabled ? 'pointer' : 'not-allowed',
    boxShadow: '0 3px 8px rgba(0,0,0,.3)',
  };
}
