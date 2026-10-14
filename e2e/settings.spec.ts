import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { CORS, mockAnthropic, seedMeals, useApiKey } from './helpers';

test('saves the key, checks it and changes the model and goal', async ({ page }) => {
  let checked = '';
  await mockAnthropic(page, async (route) => {
    checked = route.request().url();
    await route.fulfill({
      status: 200,
      headers: CORS,
      json: { id: 'claude-sonnet-5-5', type: 'model', display_name: 'Claude Sonnet 5.5', created_at: '2026-01-01T00:00:00Z' },
    });
  });
  await page.goto('./#/settings');
  await expect(page.getByLabel('Claude Haiku 5.5')).toBeChecked();
  await expect(page.getByLabel('Dzienny cel kalorii')).toHaveValue('2100');

  await page.getByLabel('Klucz API Anthropic').fill('sk-ant-moj-klucz');
  await page.getByLabel('Klucz API Anthropic').blur();
  await page.getByLabel('Claude Sonnet 5.5').check();
  await page.getByRole('button', { name: 'Sprawdź klucz' }).click();
  await expect(page.getByText('Klucz działa')).toBeVisible();
  expect(checked).toContain('/v1/models/claude-sonnet-5-5');

  await page.getByLabel('Dzienny cel kalorii').fill('1900');
  await page.getByRole('link', { name: 'Dziś' }).click();
  await expect(page.getByLabel('Podsumowanie dnia')).toContainText('1 900 kcal'.replace(' ', ' '));

  await page.reload();
  await page.getByRole('link', { name: 'Ustawienia' }).click();
  await expect(page.getByLabel('Klucz API Anthropic')).toHaveValue('sk-ant-moj-klucz');
  await expect(page.getByLabel('Claude Sonnet 5.5')).toBeChecked();
});

test('shows why a key check failed', async ({ page }) => {
  await useApiKey(page, 'sk-ant-zly');
  await mockAnthropic(page, async (route) => {
    await route.fulfill({
      status: 401,
      headers: CORS,
      json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
    });
  });
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Sprawdź klucz' }).click();
  await expect(page.getByText('Nieprawidłowy klucz API')).toBeVisible();
});

test('exports, deletes and imports the diary', async ({ page }, testInfo) => {
  await page.goto('./');
  await seedMeals(page, [{ id: 'k1', name: 'Kanapka z serem', daysAgo: 0, time: '10:00', kcal: 350 }]);
  await page.goto('./#/settings');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksportuj kopię (plik JSON)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^caloreo-kopia-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = testInfo.outputPath('kopia.json');
  await download.saveAs(backupPath);

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Usuń wszystkie posiłki' }).click();
  await expect(page.getByText('Usunięto wszystkie posiłki.')).toBeVisible();

  await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath);
  await expect(page.getByText('Zaimportowano posiłki: 1.')).toBeVisible();
  await page.getByRole('link', { name: 'Dziś' }).click();
  await expect(page.getByRole('link', { name: /Kanapka z serem/ })).toBeVisible();

  const broken = testInfo.outputPath('zly.json');
  await writeFile(broken, '{"hello": 1}');
  await page.getByRole('link', { name: 'Ustawienia' }).click();
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(broken);
  await expect(page.getByText('To nie jest plik kopii Caloreo')).toBeVisible();
});
