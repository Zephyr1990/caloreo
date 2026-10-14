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

/** Writes meals straight into IndexedDB, then reloads the page. */
export async function seedMeals(page: Page, meals: SeedMeal[]): Promise<void> {
  await page.evaluate(async (list) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const key = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const req = indexedDB.open('caloreo', 1);
    await new Promise((resolve, reject) => {
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore('meals', { keyPath: 'id' });
        store.createIndex('by-date', 'date');
      };
      req.onsuccess = resolve;
      req.onerror = reject;
    });
    const tx = req.result.transaction('meals', 'readwrite');
    for (const m of list) {
      tx.objectStore('meals').put({
        id: m.id,
        name: m.name,
        type: 'lunch',
        date: key(m.daysAgo),
        time: m.time,
        description: '',
        items: [{ id: `${m.id}-1`, name: m.name, portion: '', grams: 100, kcal: m.kcal, protein: 10, fat: 10, carbs: 10 }],
        notes: '',
        confidence: null,
        source: 'manual',
        model: null,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
    req.result.close();
  }, meals);
  await page.reload();
}
