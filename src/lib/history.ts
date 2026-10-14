import { lastDays } from './dates';
import { sumMeals } from './nutrition';
import type { Meal } from './types';

export interface DayStat {
  date: string;
  kcal: number;
  meals: number;
  isToday: boolean;
}

export interface HistorySummary {
  days: DayStat[];
  /** Average kcal over finished days that have entries (today is excluded). */
  average: number | null;
  /** Number of finished days with entries. */
  countedDays: number;
  /** Finished days with entries at or under the goal. */
  daysWithinGoal: number;
  /** Highest daily total in the range. */
  max: number;
}

export function summarizeHistory(meals: readonly Meal[], today: string, count: number, goal: number): HistorySummary {
  const byDate = new Map<string, Meal[]>();
  for (const m of meals) {
    const list = byDate.get(m.date);
    if (list) list.push(m);
    else byDate.set(m.date, [m]);
  }
  const days = lastDays(today, count).map((date) => {
    const list = byDate.get(date) ?? [];
    return { date, kcal: Math.round(sumMeals(list).kcal), meals: list.length, isToday: date === today };
  });
  const finished = days.filter((d) => !d.isToday && d.meals > 0);
  const total = finished.reduce((s, d) => s + d.kcal, 0);
  return {
    days,
    average: finished.length ? Math.round(total / finished.length) : null,
    countedDays: finished.length,
    daysWithinGoal: finished.filter((d) => d.kcal <= goal).length,
    max: days.reduce((m, d) => Math.max(m, d.kcal), 0),
  };
}

/** Top of the chart's value axis: a little above the larger of the goal and the highest day. */
export function chartMax(max: number, goal: number): number {
  const top = Math.max(max, goal, 1) * 1.1;
  return Math.ceil(top / 100) * 100;
}
