import { useMemo } from 'react';
import { randomMatchup } from '@cards/index';
import { useHashRoute } from '@ui/useHashRoute';
import { MainMenu } from '@ui/game/MainMenu';
import { CardLab } from '@ui/cardlab/CardLab';
import { PlaySetup } from '@ui/game/PlaySetup';
import { BattleScreen } from '@ui/game/BattleScreen';

const toMenu = () => {
  window.location.hash = '#/';
};

/**
 * App shell + router. `#/play` is the game (character/relic select → battle),
 * `#/attract` is an AI-vs-AI demo, `#/cardlab` is the Card Lab, and everything
 * else is the menu. The UI only reads engine and cards public APIs.
 */
export function App() {
  const route = useHashRoute();
  const attract = route.startsWith('#/attract');
  // A fresh seed per visit, so the demo isn't the same run every time. The
  // matchup itself is derived from this seed inside the battle screen, which
  // re-rolls it for each round of the loop.
  const attractSeed = useMemo(() => `attract-${Date.now()}`, [attract]);

  if (route.startsWith('#/cardlab')) return <CardLab />;
  if (route.startsWith('#/play')) return <PlaySetup onExit={toMenu} />;
  if (attract) {
    return (
      <BattleScreen
        auto
        options={{ ...randomMatchup(attractSeed), relicId: '', seed: attractSeed }}
        onExit={toMenu}
      />
    );
  }
  return <MainMenu />;
}
