import { todayKey } from './lib/dates';
import { route } from './lib/router';
import { AddMealView } from './views/AddMealView';
import { DayView } from './views/DayView';
import { FrequentView } from './views/FrequentView';
import { HistoryView } from './views/HistoryView';
import { MealView } from './views/MealView';
import { PlanSetupView } from './views/PlanSetupView';
import { SettingsView } from './views/SettingsView';
import { WeightView } from './views/WeightView';

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
    case 'weight':
      return <WeightView />;
    case 'weightPlan':
      return <PlanSetupView />;
    case 'frequent':
      return <FrequentView />;
    case 'settings':
      return <SettingsView />;
  }
}
