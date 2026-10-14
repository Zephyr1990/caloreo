import { expect, test } from '@playwright/test';
import { analysisMessage, CORS, mockAnthropic, useApiKey } from './helpers';

const CHICKEN = { name: 'Pierś z kurczaka z grilla', portion: '150 g', grams: 150, kcal: 248, protein_g: 46, fat_g: 5, carbs_g: 0 };
const RICE = { name: 'Ryż biały ugotowany', portion: '1 woreczek', grams: 260, kcal: 345, protein_g: 7, fat_g: 1, carbs_g: 78 };

test('analyzes a description with a photo, applies a correction and saves', async ({ page }) => {
  await useApiKey(page);
  const bodies: Record<string, unknown>[] = [];
  await mockAnthropic(page, async (route, body) => {
    bodies.push(body);
    const items = bodies.length === 1 ? [CHICKEN, RICE] : [CHICKEN, { ...RICE, portion: 'pół woreczka', grams: 130, kcal: 172, protein_g: 3.5, fat_g: 0.5, carbs_g: 39 }];
    await route.fulfill({ status: 200, headers: CORS, json: analysisMessage('Kurczak z ryżem', items, 'Ryż bez tłuszczu.') });
  });

  await page.goto('./');
  await page.getByRole('button', { name: 'Wpisz posiłek ręcznie' }).click();
  await page.getByLabel('Opis (mów lub pisz)').fill('kurczak z grilla 150 gramów i woreczek ryżu');
  await page.locator('input[type="file"][multiple]').setInputFiles('public/pwa-192.png');
  await expect(page.getByRole('img', { name: 'Zdjęcie 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Policz kalorie' }).click();
  await expect(page.getByRole('heading', { name: 'Sprawdź i zapisz' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pierś z kurczaka z grilla/ })).toBeVisible();
  await expect(page.getByText('Ryż bez tłuszczu.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Zapisz posiłek · 593 kcal/ })).toBeVisible();

  const first = bodies[0] as { model: string; messages: { content: { type: string; text?: string }[] }[] };
  expect(first.model).toBe('claude-haiku-5-5');
  expect(first.messages[0].content[0].type).toBe('image');
  expect(first.messages[0].content[1].text).toContain('kurczak z grilla 150 gramów');

  await page.getByLabel('Coś się nie zgadza?').fill('ryżu było pół woreczka');
  await page.getByRole('button', { name: 'Popraw i przelicz' }).click();
  await expect(page.getByRole('button', { name: /Zapisz posiłek · 420 kcal/ })).toBeVisible();
  const second = bodies[1] as { messages: { content: { type: string; text?: string }[] }[] };
  expect(second.messages[0].content.at(-1)?.text).toContain('Poprawka użytkownika: ryżu było pół woreczka');

  await page.getByRole('button', { name: /Zapisz posiłek · 420 kcal/ }).click();
  await expect(page.getByRole('heading', { name: 'Dziś' })).toBeVisible();
  const row = page.getByRole('link', { name: /Kurczak z ryżem/ });
  await expect(row).toContainText('420');
  await expect(row.locator('img')).toBeVisible();
});

test('shows a clear error for an invalid API key', async ({ page }) => {
  await useApiKey(page, 'sk-ant-wrong');
  await mockAnthropic(page, async (route) => {
    await route.fulfill({
      status: 401,
      headers: CORS,
      json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
    });
  });
  await page.goto('./#/add');
  await page.getByLabel('Opis (mów lub pisz)').fill('banan');
  await page.getByRole('button', { name: 'Policz kalorie' }).click();
  await expect(page.getByRole('alert')).toContainText('Nieprawidłowy klucz API');
  await expect(page.getByLabel('Opis (mów lub pisz)')).toHaveValue('banan');
});

test('without an API key the analysis button is disabled and manual entry works', async ({ page }) => {
  await page.goto('./#/add');
  await expect(page.getByText('Brak klucza API')).toBeVisible();
  await page.getByLabel('Opis (mów lub pisz)').fill('banan');
  await expect(page.getByRole('button', { name: 'Policz kalorie' })).toBeDisabled();
  await page.getByRole('button', { name: 'Wpisz ręcznie, bez AI' }).click();
  await expect(page.getByRole('heading', { name: 'Sprawdź i zapisz' })).toBeVisible();
});
