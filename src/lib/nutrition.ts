import type { FoodItem, Meal, MealType, Totals } from './types';

export const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 } as const;

export function emptyTotals(): Totals {
  return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
}

export function sumItems(items: readonly Pick<FoodItem, 'kcal' | 'protein' | 'fat' | 'carbs'>[]): Totals {
  const t = emptyTotals();
  for (const it of items) {
    t.kcal += safe(it.kcal);
    t.protein += safe(it.protein);
    t.fat += safe(it.fat);
    t.carbs += safe(it.carbs);
  }
  return t;
}

export function sumMeals(meals: readonly Meal[]): Totals {
  return sumItems(meals.flatMap((m) => m.items));
}

/**
 * Returns the item with a new weight, scaling kcal and macros proportionally.
 * Scaling is always done from `base` so repeated edits do not accumulate rounding errors.
 */
export function scaleItem(base: FoodItem, grams: number): FoodItem {
  const g = Math.max(0, safe(grams));
  if (base.grams <= 0) return { ...base, grams: g };
  const f = g / base.grams;
  return {
    ...base,
    grams: g,
    kcal: base.kcal * f,
    protein: base.protein * f,
    fat: base.fat * f,
    carbs: base.carbs * f,
  };
}

/**
 * Share of energy from each macronutrient, as whole percents that add up to 100
 * (largest remainder method). All zeros when there is no energy from macros.
 */
export function energyShares(t: Totals): { protein: number; fat: number; carbs: number } {
  const parts = {
    protein: safe(t.protein) * KCAL_PER_GRAM.protein,
    fat: safe(t.fat) * KCAL_PER_GRAM.fat,
    carbs: safe(t.carbs) * KCAL_PER_GRAM.carbs,
  };
  const total = parts.protein + parts.fat + parts.carbs;
  if (total <= 0) return { protein: 0, fat: 0, carbs: 0 };
  const keys = ['protein', 'fat', 'carbs'] as const;
  const exact = keys.map((k) => (parts[k] / total) * 100);
  const floors = exact.map(Math.floor);
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, r: v - floors[i] }))
    .sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] += 1;
    rest -= 1;
  }
  return { protein: floors[0], fat: floors[1], carbs: floors[2] };
}

export interface GoalProgress {
  /** Calories left to the goal (0 when over). */
  remaining: number;
  /** Calories above the goal (0 when under). */
  over: number;
  /** Consumed as a whole percent of the goal. */
  percent: number;
}

export function goalProgress(consumed: number, goal: number): GoalProgress {
  const c = Math.round(safe(consumed));
  const g = Math.round(safe(goal));
  return {
    remaining: Math.max(0, g - c),
    over: Math.max(0, c - g),
    percent: g > 0 ? Math.round((c / g) * 100) : 0,
  };
}

/** Default meal type for a time of day. */
export function mealTypeForTime(hours: number, minutes = 0): MealType {
  const m = hours * 60 + minutes;
  if (m < 5 * 60) return 'snack';
  if (m < 10 * 60 + 30) return 'breakfast';
  if (m < 12 * 60) return 'second_breakfast';
  if (m < 15 * 60 + 30) return 'lunch';
  if (m < 17 * 60 + 30) return 'afternoon_snack';
  if (m < 21 * 60) return 'dinner';
  return 'snack';
}

const NBSP = ' ';

/** Rounds and groups thousands with a non-breaking space: 1340 -> "1 340". */
export function formatNumber(n: number): string {
  const r = Math.round(safe(n));
  const sign = r < 0 ? '-' : '';
  const digits = String(Math.abs(r));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Grams for display: one decimal below 10 g, whole numbers above. */
export function formatGrams(n: number): string {
  const v = safe(n);
  if (v > 0 && v < 10) return String(Math.round(v * 10) / 10).replace('.', ',');
  return formatNumber(v);
}

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
