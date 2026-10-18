import { addDays, parseDateKey } from './dates';
import { newId } from './id';
import { sumItems } from './nutrition';
import type { FoodItem, Meal, MealType } from './types';

/*
 * Frequent foods and meals, worked out on the phone from the user's own history.
 * Pure functions so they can be unit tested.
 */

/** History used for suggestions, in days (today included). */
export const FREQUENT_WINDOW_DAYS = 60;
/** A food or meal must appear at least this many times in the window. */
export const FREQUENT_MIN_COUNT = 3;
/** An occurrence's weight halves every this many days. */
export const HALF_LIFE_DAYS = 14;
/** Occurrences this close to the current time of day (or of the chosen meal type) count double. */
export const NEAR_MINUTES = 120;
/** Names sent to the AI so it can reuse them. */
export const MAX_NAME_HINTS = 30;
export const NAME_HINT_MIN_COUNT = 2;

/** Same food = same name after lower-casing and dropping punctuation and extra spaces. */
export function normalizeName(name: string): string {
  return name
    .toLocaleLowerCase('pl')
    .replace(/[.,;:!?"'„”“()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Suggestion {
  /** Stable id, also used for hiding: "item:<name>" or "meal:<name>|<name>…". */
  key: string;
  kind: 'item' | 'meal';
  title: string;
  /** Items as eaten last time (portion and calories from the last occurrence). */
  items: FoodItem[];
  kcal: number;
  /** Occurrences in the window. */
  count: number;
  /** Median time of day, HH:MM, rounded to 15 minutes. */
  usualTime: string;
  score: number;
  /** Occurrences at this time of day or at this meal type. */
  nearCount: number;
  /** Already eaten on the day the suggestions are for. */
  eatenToday: boolean;
  lastDate: string;
}

/** What "at this time" means: the current time of day, or a chosen meal type. */
export type SuggestionContext = { time: string } | { type: MealType } | null;

export interface SuggestOptions {
  /** Day the suggestions are for (YYYY-MM-DD). */
  today: string;
  context: SuggestionContext;
  hidden?: readonly string[];
  /** Keep hidden suggestions (marked by the caller) instead of dropping them. */
  includeHidden?: boolean;
  /** Only foods eaten at least once in the context ("usually at this time"). */
  contextOnly?: boolean;
  limit?: number;
}

interface Occurrence {
  meal: Meal;
  /** Items behind this occurrence: one item, or the whole meal. */
  items: FoodItem[];
}

function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function circularGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
}

function ageInDays(date: string, today: string): number {
  return Math.max(0, Math.round((parseDateKey(today).getTime() - parseDateKey(date).getTime()) / 86_400_000));
}

function isNear(meal: Meal, context: SuggestionContext): boolean {
  if (!context) return false;
  if ('type' in context) return meal.type === context.type;
  return circularGap(minutes(meal.time), minutes(context.time)) <= NEAR_MINUTES;
}

function medianTime(times: number[]): string {
  const sorted = [...times].sort((a, b) => a - b);
  const mid = sorted[Math.floor((sorted.length - 1) / 2)];
  const rounded = (Math.round(mid / 15) * 15) % 1440;
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function byNewest(a: Meal, b: Meal): number {
  return a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date);
}

/** Groups the window's meals by food and by whole meal (two or more distinct foods). */
function group(meals: readonly Meal[], today: string): Map<string, { kind: 'item' | 'meal'; occ: Occurrence[] }> {
  const from = addDays(today, -(FREQUENT_WINDOW_DAYS - 1));
  const groups = new Map<string, { kind: 'item' | 'meal'; occ: Occurrence[] }>();
  const add = (key: string, kind: 'item' | 'meal', o: Occurrence) => {
    const g = groups.get(key) ?? { kind, occ: [] };
    g.occ.push(o);
    groups.set(key, g);
  };
  for (const meal of [...meals].filter((m) => m.date >= from && m.date <= today).sort(byNewest)) {
    const seen = new Set<string>();
    for (const item of meal.items) {
      const name = normalizeName(item.name);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      add(`item:${name}`, 'item', { meal, items: [item] });
    }
    if (seen.size >= 2) add(`meal:${[...seen].sort().join('|')}`, 'meal', { meal, items: meal.items.filter((i) => i.name.trim()) });
  }
  return groups;
}

/**
 * Suggestions ranked for the context: not yet eaten that day first, then foods eaten in the
 * context, then by score.
 */
export function frequentSuggestions(meals: readonly Meal[], opts: SuggestOptions): Suggestion[] {
  const hidden = new Set(opts.hidden ?? []);
  const out: Suggestion[] = [];
  for (const [key, g] of group(meals, opts.today)) {
    if (g.occ.length < FREQUENT_MIN_COUNT) continue;
    if (hidden.has(key) && !opts.includeHidden) continue;
    const last = g.occ[g.occ.length - 1];
    let score = 0;
    let nearCount = 0;
    for (const o of g.occ) {
      const weight = 0.5 ** (ageInDays(o.meal.date, opts.today) / HALF_LIFE_DAYS);
      const near = isNear(o.meal, opts.context);
      if (near) nearCount++;
      score += near ? 2 * weight : weight;
    }
    if (opts.contextOnly && opts.context && nearCount === 0) continue;
    const items = last.items.map((i) => ({ ...i }));
    out.push({
      key,
      kind: g.kind,
      title: g.kind === 'meal' ? last.meal.name.trim() || items.map((i) => i.name.trim()).join(', ') : items[0].name.trim(),
      items,
      kcal: sumItems(items).kcal,
      count: g.occ.length,
      usualTime: medianTime(g.occ.map((o) => minutes(o.meal.time))),
      score,
      nearCount,
      eatenToday: g.occ.some((o) => o.meal.date === opts.today),
      lastDate: last.meal.date,
    });
  }
  out.sort(
    (a, b) =>
      Number(a.eatenToday) - Number(b.eatenToday) ||
      Number(b.nearCount > 0) - Number(a.nearCount > 0) ||
      b.score - a.score ||
      b.count - a.count ||
      a.title.localeCompare(b.title, 'pl'),
  );
  return opts.limit === undefined ? out : out.slice(0, opts.limit);
}

/**
 * Food names the user already has, most frequent first, for the AI to reuse so the
 * same food keeps one name.
 */
export function frequentNames(meals: readonly Meal[], today: string, max: number = MAX_NAME_HINTS): string[] {
  const out: { name: string; count: number; last: string }[] = [];
  for (const [key, g] of group(meals, today)) {
    if (g.kind !== 'item' || g.occ.length < NAME_HINT_MIN_COUNT) continue;
    const last = g.occ[g.occ.length - 1];
    out.push({ name: last.items[0].name.trim(), count: g.occ.length, last: `${last.meal.date} ${last.meal.time} ${key}` });
  }
  out.sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
  return out.slice(0, max).map((n) => n.name);
}

/** Fresh copies of a suggestion's items, ready for a new meal. */
export function suggestionItems(s: Pick<Suggestion, 'items'>): FoodItem[] {
  return s.items.map((i) => ({ ...i, id: newId() }));
}
