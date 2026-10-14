import { todayKey } from './lib/dates';
import { route } from './lib/router';
import { AddMealView } from './views/AddMealView';
import { DayView } from './views/DayView';
import { HistoryView } from './views/HistoryView';
import { MealView } from './views/MealView';
import { SettingsView } from './views/SettingsView';

export function App() {
  const r = route.value;
  switch (r.name) {
    case 'day':
      return <DayView date={r.date ?? todayKey()} />;
    case 'add':
      return <AddMealView />;
    case 'meal':
      return <MealView id={r.id} />;
    case 'history':
      return <HistoryView />;
    case 'settings':
      return <SettingsView />;
  }
}
