import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { allMeals, allWeights, closeDb, DB_NAME, getActivity, saveActivity, saveWeight } from '../src/lib/db';

describe('database upgrade from version 1', () => {
  it('keeps existing meals and adds weight and activity stores', async () => {
    // A phone that ran the first release has only the meals store.
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(database) {
        const store = database.createObjectStore('meals', { keyPath: 'id' });
        store.createIndex('by-date', 'date');
      },
    });
    await v1.put('meals', { id: 'old', date: '2026-10-14', time: '12:00', createdAt: '', name: 'Stary obiad', items: [] });
    v1.close();

    expect((await allMeals()).map((m) => m.id)).toEqual(['old']);
    await saveWeight({ date: '2026-10-14', kg: 80, updatedAt: '' });
    await saveActivity({ date: '2026-10-14', activeKcal: 650, steps: null, updatedAt: '' });
    expect(await allWeights()).toHaveLength(1);
    expect((await getActivity('2026-10-14'))?.activeKcal).toBe(650);
    await closeDb();
  });
});
