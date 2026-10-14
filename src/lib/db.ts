import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { signal } from '@preact/signals';
import type { ActivityEntry, Meal, WeightEntry } from './types';

interface CaloreoDB extends DBSchema {
  meals: {
    key: string;
    value: Meal;
    indexes: { 'by-date': string };
  };
  weights: {
    key: string;
    value: WeightEntry;
  };
  activity: {
    key: string;
    value: ActivityEntry;
  };
}

export const DB_NAME = 'caloreo';
export const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<CaloreoDB>> | null = null;

function db(): Promise<IDBPDatabase<CaloreoDB>> {
  dbPromise ??= openDB<CaloreoDB>(DB_NAME, DB_VERSION, {
    // Each step only adds stores, so upgrading never touches existing meals.
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore('meals', { keyPath: 'id' });
        store.createIndex('by-date', 'date');
      }
      if (oldVersion < 2) {
        database.createObjectStore('weights', { keyPath: 'date' });
        database.createObjectStore('activity', { keyPath: 'date' });
      }
    },
  });
  return dbPromise;
}

/** Bumped after every write so views can reload their data. */
export const mealsVersion = signal(0);

function changed() {
  mealsVersion.value++;
}

export function sortMeals(meals: Meal[]): Meal[] {
  return meals.sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt),
  );
}

export async function mealsForDate(date: string): Promise<Meal[]> {
  return sortMeals(await (await db()).getAllFromIndex('meals', 'by-date', date));
}

/** Meals from `from` to `to`, both inclusive. */
export async function mealsInRange(from: string, to: string): Promise<Meal[]> {
  return sortMeals(await (await db()).getAllFromIndex('meals', 'by-date', IDBKeyRange.bound(from, to)));
}

export async function allMeals(): Promise<Meal[]> {
  return sortMeals(await (await db()).getAll('meals'));
}

export async function getMeal(id: string): Promise<Meal | undefined> {
  return (await db()).get('meals', id);
}

export async function saveMeal(meal: Meal): Promise<void> {
  await (await db()).put('meals', meal);
  changed();
}

/** Adds or replaces meals by id in a single transaction. */
export async function saveMeals(meals: readonly Meal[]): Promise<void> {
  const tx = (await db()).transaction('meals', 'readwrite');
  await Promise.all([...meals.map((m) => tx.store.put(m)), tx.done]);
  changed();
}

export async function deleteMeal(id: string): Promise<void> {
  await (await db()).delete('meals', id);
  changed();
}

export async function clearMeals(): Promise<void> {
  await (await db()).clear('meals');
  changed();
}

/** Test helper: closes the connection so the next call opens a fresh one. */
export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

/** Asks the browser not to evict our data. Safe to call many times. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Bumped after every weight or activity write. */
export const bodyVersion = signal(0);

function bodyChanged() {
  bodyVersion.value++;
}

const byDate = <T extends { date: string }>(list: T[]): T[] => list.sort((a, b) => a.date.localeCompare(b.date));

export async function allWeights(): Promise<WeightEntry[]> {
  return byDate(await (await db()).getAll('weights'));
}

export async function saveWeight(entry: WeightEntry): Promise<void> {
  await (await db()).put('weights', entry);
  bodyChanged();
}

export async function deleteWeight(date: string): Promise<void> {
  await (await db()).delete('weights', date);
  bodyChanged();
}

export async function allActivity(): Promise<ActivityEntry[]> {
  return byDate(await (await db()).getAll('activity'));
}

export async function activityInRange(from: string, to: string): Promise<ActivityEntry[]> {
  return byDate(await (await db()).getAll('activity', IDBKeyRange.bound(from, to)));
}

export async function getActivity(date: string): Promise<ActivityEntry | undefined> {
  return (await db()).get('activity', date);
}

export async function saveActivity(entry: ActivityEntry): Promise<void> {
  await (await db()).put('activity', entry);
  bodyChanged();
}

export async function deleteActivity(date: string): Promise<void> {
  await (await db()).delete('activity', date);
  bodyChanged();
}

/** Adds or replaces weigh-ins and activity days in a single transaction. */
export async function saveBodyData(weights: readonly WeightEntry[], activity: readonly ActivityEntry[]): Promise<void> {
  const tx = (await db()).transaction(['weights', 'activity'], 'readwrite');
  await Promise.all([
    ...weights.map((w) => tx.objectStore('weights').put(w)),
    ...activity.map((a) => tx.objectStore('activity').put(a)),
    tx.done,
  ]);
  bodyChanged();
}

/** Removes meals, weigh-ins and activity. Settings, profile and plan stay. */
export async function clearAllData(): Promise<void> {
  const tx = (await db()).transaction(['meals', 'weights', 'activity'], 'readwrite');
  await Promise.all([tx.objectStore('meals').clear(), tx.objectStore('weights').clear(), tx.objectStore('activity').clear(), tx.done]);
  changed();
  bodyChanged();
}
