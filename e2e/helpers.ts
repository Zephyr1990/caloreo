import type { Page, Route } from '@playwright/test';

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

export interface FakeItem {
  name: string;
  portion: string;
  grams: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export function analysisMessage(mealName: string, items: FakeItem[], notes = '') {
  const analysis = { is_food: true, meal_name: mealName, items, confidence: 'medium', notes };
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [{ type: 'text', text: JSON.stringify(analysis) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 300 },
  };
}

/** Answers Anthropic API calls with `handler`; also answers CORS preflights. */
export async function mockAnthropic(
  page: Page,
  handler: (route: Route, body: Record<string, unknown>) => Promise<void> | void,
): Promise<void> {
  await page.route('https://api.anthropic.com/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    await handler(route, route.request().postDataJSON() ?? {});
  });
}

export async function useApiKey(page: Page, key = 'sk-ant-test'): Promise<void> {
  await page.addInitScript((k) => {
    localStorage.setItem('caloreo.settings', JSON.stringify({ apiKey: k, model: 'claude-haiku-5-5', dailyGoal: 2100 }));
  }, key);
}

export interface SeedMeal {
  id: string;
  name: string;
  /** Days before today (0 = today). */
  daysAgo: number;
  time: string;
  kcal: number;
}

/** Opens the app database (version 2) in the page and writes records into a store. */
async function putRecords(page: Page, store: 'meals' | 'weights' | 'activity', records: unknown[]): Promise<void> {
  await page.evaluate(
    async ({ store, records }) => {
      const req = indexedDB.open('caloreo', 2);
      await new Promise((resolve, reject) => {
        req.onupgradeneeded = (e) => {
          const db = req.result;
          if ((e as IDBVersionChangeEvent).oldVersion < 1) db.createObjectStore('meals', { keyPath: 'id' }).createIndex('by-date', 'date');
          if ((e as IDBVersionChangeEvent).oldVersion < 2) {
            db.createObjectStore('weights', { keyPath: 'date' });
            db.createObjectStore('activity', { keyPath: 'date' });
          }
        };
        req.onsuccess = resolve;
        req.onerror = reject;
      });
      const tx = req.result.transaction(store, 'readwrite');
      for (const r of records) tx.objectStore(store).put(r);
      await new Promise((resolve) => {
        tx.oncomplete = resolve;
      });
      req.result.close();
    },
    { store, records },
  );
}

/** Local date key for "n days ago", computed like the app does. */
export function dateKey(daysAgo: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Writes meals straight into IndexedDB, then reloads the page. */
export async function seedMeals(page: Page, meals: SeedMeal[]): Promise<void> {
  const stamp = new Date().toISOString();
  await putRecords(
    page,
    'meals',
    meals.map((m) => ({
      id: m.id,
      name: m.name,
      type: 'lunch',
      date: dateKey(m.daysAgo),
      time: m.time,
      description: '',
      items: [{ id: `${m.id}-1`, name: m.name, portion: '', grams: 100, kcal: m.kcal, protein: 10, fat: 10, carbs: 10 }],
      notes: '',
      confidence: null,
      source: 'manual',
      model: null,
      thumbnail: null,
      createdAt: stamp,
      updatedAt: stamp,
    })),
  );
  await page.reload();
}

export async function seedWeights(page: Page, weights: { daysAgo: number; kg: number }[]): Promise<void> {
  await putRecords(page, 'weights', weights.map((w) => ({ date: dateKey(w.daysAgo), kg: w.kg, updatedAt: '' })));
  await page.reload();
}

export async function seedActivity(page: Page, days: { daysAgo: number; activeKcal: number; steps?: number }[]): Promise<void> {
  await putRecords(
    page,
    'activity',
    days.map((d) => ({ date: dateKey(d.daysAgo), activeKcal: d.activeKcal, steps: d.steps ?? null, updatedAt: '' })),
  );
  await page.reload();
}

/** Stores a profile (36-year-old man, 183 cm, high activity) and optionally a plan, before the app loads. */
export async function useBody(page: Page, plan?: { startDaysAgo: number; startWeight: number; targetWeight: number; targetInDays: number }) {
  const body = {
    profile: { sex: 'male', birthYear: new Date().getFullYear() - 36, heightCm: 183, activity: 'high' },
    plan: plan
      ? {
          startDate: dateKey(plan.startDaysAgo),
          startWeight: plan.startWeight,
          targetWeight: plan.targetWeight,
          targetDate: dateKey(-plan.targetInDays),
          acceptedUnsafe: false,
          createdAt: '',
        }
      : null,
    goalSource: plan ? 'plan' : 'manual',
  };
  await page.addInitScript((b) => {
    if (!localStorage.getItem('caloreo.body')) localStorage.setItem('caloreo.body', JSON.stringify(b));
  }, body);
}
