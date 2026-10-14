import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { signal } from '@preact/signals';
import type { Meal } from './types';

interface CaloreoDB extends DBSchema {
  meals: {
    key: string;
    value: Meal;
    indexes: { 'by-date': string };
  };
}

const DB_NAME = 'caloreo';

let dbPromise: Promise<IDBPDatabase<CaloreoDB>> | null = null;

function db(): Promise<IDBPDatabase<CaloreoDB>> {
  dbPromise ??= openDB<CaloreoDB>(DB_NAME, 1, {
    upgrade(database) {
      const store = database.createObjectStore('meals', { keyPath: 'id' });
      store.createIndex('by-date', 'date');
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
