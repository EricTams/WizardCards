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
 * `#/attract` is an AI-vs-AI demo (Wizard vs Cloud), `#/cardlab` is the Card Lab,
 * and everything else is the menu. The UI only reads engine and cards public APIs.
 */
export function App() {
  const route = useHashRoute();
  if (route.startsWith('#/cardlab')) return <CardLab />;
  if (route.startsWith('#/play')) return <PlaySetup onExit={toMenu} />;
  if (route.startsWith('#/attract')) {
    return (
      <BattleScreen
        auto
        options={{ character: 'wizard', relicId: '', seed: 'attract', enemyCharacter: 'cloud' }}
        onExit={toMenu}
      />
    );
  }
  return <MainMenu />;
}
