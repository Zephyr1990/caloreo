import { signal } from '@preact/signals';
import { timeOf, todayKey } from './dates';
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

/** State of the "add meal" flow. Lives outside the view so it survives navigation. */
export interface AddDraft {
  phase: AddPhase;
  description: string;
  photos: DraftPhoto[];
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

/** A meal draft built from the compose step, for manual entry. */
export function manualMealFromDraft(d: AddDraft): MealDraft {
  return {
    name: '',
    type: d.type,
    date: d.date,
    time: d.time,
    description: d.description.trim(),
    items: [emptyItem()],
    notes: '',
    confidence: null,
    source: 'manual',
    model: null,
    thumbnail: d.photos[0]?.thumb ?? null,
  };
}
