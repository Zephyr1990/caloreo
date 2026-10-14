import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  allMeals,
  clearMeals,
  closeDb,
  deleteMeal,
  getMeal,
  mealsForDate,
  mealsInRange,
  mealsVersion,
  saveMeal,
  saveMeals,
} from '../src/lib/db';
import type { Meal } from '../src/lib/types';

function meal(id: string, date: string, time: string): Meal {
  return {
    id,
    name: `Posiłek ${id}`,
    type: 'lunch',
    date,
    time,
    description: '',
    items: [{ id: `${id}-1`, name: 'Ryż', portion: '', grams: 100, kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 }],
    notes: '',
    confidence: null,
    source: 'manual',
    model: null,
    thumbnail: null,
    createdAt: `${date}T${time}:00.000Z`,
    updatedAt: `${date}T${time}:00.000Z`,
  };
}

afterEach(async () => {
  await clearMeals();
  await closeDb();
});

describe('db', () => {
  it('saves, reads and deletes meals', async () => {
    const before = mealsVersion.value;
    await saveMeal(meal('a', '2026-10-14', '13:40'));
    expect(mealsVersion.value).toBe(before + 1);
    expect((await getMeal('a'))?.name).toBe('Posiłek a');
    await deleteMeal('a');
    expect(await getMeal('a')).toBeUndefined();
  });

  it('returns meals of a day sorted by time', async () => {
    await saveMeals([meal('late', '2026-10-14', '19:00'), meal('early', '2026-10-14', '07:45'), meal('other', '2026-10-13', '12:00')]);
    expect((await mealsForDate('2026-10-14')).map((m) => m.id)).toEqual(['early', 'late']);
  });

  it('returns meals in an inclusive date range', async () => {
    await saveMeals([meal('a', '2026-10-10', '12:00'), meal('b', '2026-10-12', '12:00'), meal('c', '2026-10-15', '12:00')]);
    expect((await mealsInRange('2026-10-10', '2026-10-12')).map((m) => m.id)).toEqual(['a', 'b']);
    expect(await allMeals()).toHaveLength(3);
  });

  it('replaces a meal with the same id', async () => {
    await saveMeal(meal('a', '2026-10-14', '13:40'));
    await saveMeal({ ...meal('a', '2026-10-14', '13:40'), name: 'Zmieniony' });
    expect(await allMeals()).toHaveLength(1);
    expect((await getMeal('a'))?.name).toBe('Zmieniony');
  });
});
