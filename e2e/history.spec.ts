import { expect, test } from '@playwright/test';
import { seedMeals } from './helpers';

test('shows daily totals, the average and lets you open a day', async ({ page }) => {
  await page.goto('./');
  await seedMeals(page, [
    { id: 'a', name: 'Obiad A', daysAgo: 3, time: '13:00', kcal: 1800 },
    { id: 'b', name: 'Obiad B', daysAgo: 2, time: '13:00', kcal: 2400 },
    { id: 'c', name: 'Śniadanie C', daysAgo: 1, time: '08:00', kcal: 900 },
    { id: 'd', name: 'Kolacja D', daysAgo: 1, time: '19:00', kcal: 1000 },
    { id: 'e', name: 'Dzisiaj E', daysAgo: 0, time: '09:00', kcal: 500 },
  ]);

  await page.getByRole('link', { name: 'Historia' }).click();
  await expect(page.getByRole('heading', { name: 'Historia' })).toBeVisible();
  // Average of the three finished days: (1800 + 2400 + 1900) / 3 = 2033.
  await expect(page.getByText('2 033')).toBeVisible();
  await expect(page.getByText('2 z 3')).toBeVisible();
  await expect(page.getByText('300 ponad cel')).toBeVisible();

  await page.getByRole('button', { name: /: 2400 kcal/ }).click();
  await expect(page.getByText('Otwórz dzień')).toBeVisible();

  await page.getByRole('button', { name: '30 dni' }).click();
  await expect(page.getByText('ostatnie 30 dni')).toBeVisible();
  await expect(page.getByRole('button', { name: /brak wpisów/ })).toHaveCount(26);

  await page.getByRole('link', { name: /1\s900 kcal/ }).click();
  await expect(page.getByRole('heading', { name: 'Wczoraj' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Kolacja D/ })).toBeVisible();
});

test('eats a meal from yesterday again today', async ({ page }) => {
  await page.goto('./');
  await seedMeals(page, [{ id: 'y', name: 'Owsianka z jabłkiem', daysAgo: 1, time: '07:30', kcal: 420 }]);

  await page.getByRole('link', { name: 'Poprzedni dzień' }).click();
  await page.getByRole('link', { name: /Owsianka z jabłkiem/ }).click();
  await page.getByRole('button', { name: 'Zjedz ponownie' }).click();

  await expect(page.getByRole('heading', { name: 'Dziś' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Owsianka z jabłkiem/ })).toBeVisible();
  await expect(page.getByLabel('Podsumowanie dnia')).toContainText('420');

  // The original stays on yesterday.
  await page.getByRole('link', { name: 'Poprzedni dzień' }).click();
  await expect(page.getByRole('link', { name: /Owsianka z jabłkiem/ })).toBeVisible();
});

test('deletes a meal after confirmation', async ({ page }) => {
  await page.goto('./');
  await seedMeals(page, [{ id: 'z', name: 'Pączek', daysAgo: 0, time: '11:00', kcal: 300 }]);
  await page.getByRole('link', { name: /Pączek/ }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Usuń' }).click();
  await expect(page.getByRole('heading', { name: 'Dziś' })).toBeVisible();
  await expect(page.getByText('Nic jeszcze nie zapisano.')).toBeVisible();
});
