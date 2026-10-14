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
  source: 'ai' | 'manual';
  model: string | null;
  /** Small JPEG data URL of the first photo. */
  thumbnail: string | null;
}

export interface Meal extends MealDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}
