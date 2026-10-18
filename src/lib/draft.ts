import { signal } from '@preact/signals';
import { timeOf, todayKey } from './dates';
import { suggestionItems, type Suggestion } from './frequent';
import { newId } from './id';
import { mealTypeForTime } from './nutrition';
import type { FoodItem, MealDraft, MealType } from './types';

export interface DraftPhoto {
  id: string;
  /** Resized JPEG sent to the AI. */
  dataUrl: string;
  /** Small JPEG kept with the saved meal. */
  thumb: string;
}

export type AddPhase = 'compose' | 'analyzing' | 'review';

/** A frequent food or meal picked for the new meal. */
export type PickedFood = Pick<Suggestion, 'key' | 'kind' | 'title' | 'items' | 'kcal'>;

/** State of the "add meal" flow. Lives outside the view so it survives navigation. */
export interface AddDraft {
  phase: AddPhase;
  description: string;
  photos: DraftPhoto[];
  /** Frequent foods picked on the compose step; added to the meal as they are. */
  picked: PickedFood[];
  type: MealType;
  date: string;
  time: string;
  meal: MealDraft | null;
  error: string | null;
}

export function freshDraft(date: string = todayKey(), now: Date = new Date()): AddDraft {
  return {
    phase: 'compose',
    description: '',
    photos: [],
    picked: [],
    type: mealTypeForTime(now.getHours(), now.getMinutes()),
    date,
    time: timeOf(now),
    meal: null,
    error: null,
  };
}

export const addDraft = signal<AddDraft>(freshDraft());

export function patchDraft(patch: Partial<AddDraft>): void {
  addDraft.value = { ...addDraft.value, ...patch };
}

/** Starts a new meal on the given day. */
export function startDraft(date: string = todayKey()): void {
  addDraft.value = freshDraft(date);
}

export function emptyItem(): FoodItem {
  return { id: newId(), name: '', portion: '', grams: 0, kcal: 0, protein: 0, fat: 0, carbs: 0 };
}

export function pickedItems(d: Pick<AddDraft, 'picked'>): FoodItem[] {
  return d.picked.flatMap(suggestionItems);
}

/** A meal draft built from the compose step, for manual entry (after any picked foods). */
export function manualMealFromDraft(d: AddDraft): MealDraft {
  return {
    name: '',
    type: d.type,
    date: d.date,
    time: d.time,
    description: d.description.trim(),
    items: [...pickedItems(d), emptyItem()],
    notes: '',
    confidence: null,
    source: 'manual',
    model: null,
    thumbnail: d.photos[0]?.thumb ?? null,
  };
}

/** A meal made only of picked frequent foods, without AI. */
export function frequentMealFromDraft(d: AddDraft): MealDraft {
  const only = d.picked.length === 1 ? d.picked[0] : null;
  return {
    name: only?.kind === 'meal' ? only.title : '',
    type: d.type,
    date: d.date,
    time: d.time,
    description: d.description.trim(),
    items: pickedItems(d),
    notes: '',
    confidence: null,
    source: 'frequent',
    model: null,
    thumbnail: d.photos[0]?.thumb ?? null,
  };
}

/** Starts a new meal from one suggestion and goes straight to the review step. */
export function startFromSuggestion(date: string, s: PickedFood): void {
  const d: AddDraft = { ...freshDraft(date), picked: [s] };
  addDraft.value = { ...d, phase: 'review', meal: frequentMealFromDraft(d) };
}

export function togglePicked(s: PickedFood): void {
  const picked = addDraft.value.picked;
  patchDraft({ picked: picked.some((p) => p.key === s.key) ? picked.filter((p) => p.key !== s.key) : [...picked, s] });
}
