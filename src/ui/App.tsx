import { useHashRoute } from '@ui/useHashRoute';
import { MainMenu } from '@ui/game/MainMenu';
import { CardLab } from '@ui/cardlab/CardLab';

/**
 * App shell + router. The Card Lab is reachable from the main menu at
 * '#/cardlab'; everything else shows the menu. The UI only ever reads engine
 * and cards public APIs.
 */
export function App() {
  const route = useHashRoute();
  if (route.startsWith('#/cardlab')) return <CardLab />;
  return <MainMenu />;
}
