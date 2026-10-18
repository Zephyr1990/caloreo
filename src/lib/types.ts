export type MealType =
  | 'breakfast'
  | 'second_breakfast'
  | 'lunch'
  | 'afternoon_snack'
  | 'dinner'
  | 'snack';

export const MEAL_TYPES: readonly { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Śniadanie' },
  { id: 'second_breakfast', label: 'II śniadanie' },
  { id: 'lunch', label: 'Obiad' },
  { id: 'afternoon_snack', label: 'Podwieczorek' },
  { id: 'dinner', label: 'Kolacja' },
  { id: 'snack', label: 'Przekąska' },
];

export function mealTypeLabel(type: MealType): string {
  return MEAL_TYPES.find((t) => t.id === type)?.label ?? type;
}

export type Confidence = 'low' | 'medium' | 'high';

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  low: 'niska',
  medium: 'średnia',
  high: 'wysoka',
};

/** One food or drink inside a meal. Nutrition values are for the whole portion. */
export interface FoodItem {
  id: string;
  name: string;
  /** Human-readable portion, e.g. "1 woreczek (ok. 260 g po ugotowaniu)". */
  portion: string;
  grams: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Totals {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export type MealSource = 'ai' | 'manual' | 'frequent';

/** Everything the meal editor works on, before the meal gets an id. */
export interface MealDraft {
  name: string;
  type: MealType;
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** Local time, HH:MM. */
  time: string;
  /** What the user said or typed. */
  description: string;
  items: FoodItem[];
  /** Assumptions made by the AI. */
  notes: string;
  confidence: Confidence | null;
  /** frequent: built from a suggestion of frequent foods, without AI. */
  source: MealSource;
  model: string | null;
  /** Small JPEG data URL of the first photo. */
  thumbnail: string | null;
}

export interface Meal extends MealDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type Sex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';

export interface Profile {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  /** Declared activity, used until there is enough data from Garmin. */
  activity: ActivityLevel;
}

export interface WeightPlan {
  /** Day the plan was set (YYYY-MM-DD). */
  startDate: string;
  startWeight: number;
  targetWeight: number;
  targetDate: string;
  /** The user saved this plan despite threshold warnings; the daily target is not clamped. */
  acceptedUnsafe: boolean;
  createdAt: string;
}

/** One weigh-in per day. */
export interface WeightEntry {
  date: string;
  kg: number;
  updatedAt: string;
}

/** Activity of one day, entered from Garmin. */
export interface ActivityEntry {
  date: string;
  /** Garmin "active calories" for the whole day (steps and workouts). */
  activeKcal: number | null;
  /** Shown for information only; not added to the burn (already in active calories). */
  steps: number | null;
  updatedAt: string;
}
