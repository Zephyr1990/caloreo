import { expect, test } from '@playwright/test';

test('adds a meal by hand and shows it on the day screen', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Dziś' })).toBeVisible();
  await expect(page.getByText('Nic jeszcze nie zapisano.')).toBeVisible();

  await page.getByRole('button', { name: 'Wpisz posiłek ręcznie' }).click();
  await expect(page.getByRole('heading', { name: 'Nowy posiłek' })).toBeVisible();
  await page.getByLabel('Opis (mów lub pisz)').fill('Owsianka na mleku');
  await page.getByRole('button', { name: 'Wpisz ręcznie' }).click();

  await expect(page.getByRole('heading', { name: 'Sprawdź i zapisz' })).toBeVisible();
  await page.getByLabel('Nazwa posiłku').fill('Owsianka');
  await page.getByLabel('Nazwa', { exact: true }).fill('Płatki owsiane');
  await page.getByLabel('Gramy').fill('60');
  await page.getByLabel('Kalorie').fill('220');
  await page.getByLabel('Białko g').fill('8');
  await page.getByRole('button', { name: /Zapisz posiłek · 220 kcal/ }).click();

  await expect(page.getByRole('heading', { name: 'Dziś' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Owsianka/ })).toBeVisible();
  await expect(page.getByLabel('Podsumowanie dnia')).toContainText('220');

  // Editing grams scales the calories.
  await page.getByRole('link', { name: /Owsianka/ }).click();
  await page.getByRole('button', { name: /Płatki owsiane/ }).click();
  await page.getByLabel('Gramy').fill('120');
  await expect(page.getByLabel('Kalorie')).toHaveValue('440');
  await page.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(page.getByLabel('Podsumowanie dnia')).toContainText('440');
});
