import { useEffect, useState } from 'preact/hooks';
import { addDays } from './dates';
import { mealsInRange, mealsVersion } from './db';
import { FREQUENT_WINDOW_DAYS, frequentSuggestions, type SuggestOptions, type Suggestion } from './frequent';
import { settings } from './settings';
import type { Meal } from './types';

/** Frequent foods and meals for `opts.today`; reloads after every change to meals. null while loading. */
export function useFrequent(opts: Omit<SuggestOptions, 'hidden'>): Suggestion[] | null {
  const version = mealsVersion.value;
  const [meals, setMeals] = useState<Meal[] | null>(null);
  useEffect(() => {
    let alive = true;
    mealsInRange(addDays(opts.today, -(FREQUENT_WINDOW_DAYS - 1)), opts.today).then((m) => alive && setMeals(m));
    return () => {
      alive = false;
    };
  }, [opts.today, version]);
  return meals ? frequentSuggestions(meals, { ...opts, hidden: settings.value.hiddenFrequent }) : null;
}
