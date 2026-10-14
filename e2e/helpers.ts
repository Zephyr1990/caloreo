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
