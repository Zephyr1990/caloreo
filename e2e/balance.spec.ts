import { expect, test } from '@playwright/test';
import { seedActivity, seedMeals, useBody } from './helpers';

// Profile from the helpers: 36-year-old man, 80 kg, 183 cm. Base burn 1768,75 × 1,2 = 2122,5 kcal.
// Plan: 80 → 74 kg in 70 days, i.e. 6 × 7700 / 70 = 660 kcal of deficit a day.
const PLAN = { startDaysAgo: 10, startWeight: 80, targetWeight: 74, targetInDays: 70 };
const lastWeek = (activeKcal: number) => [1, 2, 3, 4, 5, 6, 7].map((daysAgo) => ({ daysAgo, activeKcal }));

test('during the day the summary estimates the balance and forecasts the evening', async ({ page }) => {
  await useBody(page, PLAN);
  await page.goto('./');
  await seedMeals(page, [{ id: 't1', name: 'Śniadanie', daysAgo: 0, time: '08:00', kcal: 540 }]);
  await seedActivity(page, lastWeek(680));

  const summary = page.getByLabel('Podsumowanie dnia');
  await expect(summary.getByText('Bilans na teraz')).toBeVisible();
  await expect(summary.getByText('szacunek', { exact: true })).toBeVisible();
  const balance = page.getByRole('group', { name: 'Bilans na teraz' });
  // 2122,5 + 680 = 2802,5 burned; 2802,5 − 540 = 2262,5 so far.
  await expect(balance).toContainText('ok. 2 800');
  await expect(balance).toContainText('ok. 2 260');
  await expect(balance).toContainText('Deficyt');
  // Goal 2802,5 − 660 ≈ 2 140 kcal; eating the rest leaves the plan's deficit.
  await expect(summary).toContainText('/ 2 140 kcal');
  await expect(summary).toContainText('Jeśli zjesz resztę celu (1 600 kcal), deficyt wyniesie ok. 660 kcal, plan 660.');
  await expect(summary).toContainText('Szacunek ze średniej aktywności z ostatnich 7 dni (680 kcal).');

  await page.getByRole('button', { name: 'Wpisz z Garmina' }).click();
  await expect(page.getByLabel('Kalorie aktywne')).toBeFocused();
  await page.getByLabel('Kalorie aktywne').fill('940');
  await page.getByRole('button', { name: 'Zapisz aktywność' }).click();

  await expect(summary.getByText('Bilans dnia')).toBeVisible();
  await expect(summary.getByText('z Garmina', { exact: true })).toBeVisible();
  const measured = page.getByRole('group', { name: 'Bilans dnia' });
  // 2122,5 + 940 = 3062,5 burned; 3062,5 − 540 = 2522,5.
  await expect(measured).toContainText('3 063');
  await expect(measured).toContainText('2 523');
  await expect(summary).toContainText('Więcej niż wymaga plan (660 kcal)');
  await expect(page.getByRole('button', { name: 'Wpisz z Garmina' })).toHaveCount(0);
});

test('a surplus is shown with a word and an arrow, not only a colour', async ({ page }) => {
  await useBody(page, PLAN);
  await page.goto('./');
  await seedMeals(page, [{ id: 't1', name: 'Pizza', daysAgo: 0, time: '19:00', kcal: 3500 }]);
  await seedActivity(page, [{ daysAgo: 0, activeKcal: 300 }]);

  const balance = page.getByRole('group', { name: 'Bilans dnia' });
  // 2122,5 + 300 − 3500 = −1077,5.
  await expect(balance).toContainText('Nadwyżka');
  await expect(balance).toContainText('1 078');
  await expect(page.getByLabel('Podsumowanie dnia')).toContainText('Nadwyżka, a plan wymaga deficytu (660 kcal)');
});

test('the plan row shows the average balance of the last 7 days', async ({ page }) => {
  await useBody(page, PLAN);
  await page.goto('./');
  await seedMeals(
    page,
    [1, 2, 3, 4, 5].map((d) => ({ id: `m${d}`, name: `Dzień ${d}`, daysAgo: d, time: '13:00', kcal: 2000 })),
  );
  await seedActivity(page, [1, 2, 3, 4, 5].map((daysAgo) => ({ daysAgo, activeKcal: 700 })));
  // 2122,5 + 700 − 2000 = 822,5 kcal a day.
  await expect(page.getByRole('link', { name: /Cel z planu wagi/ })).toContainText('5 z 7 dni: średnio 823 kcal deficytu · plan 660');
});

test('without a profile the summary points to the weight tab', async ({ page }) => {
  await page.goto('./');
  await seedMeals(page, [{ id: 't1', name: 'Obiad', daysAgo: 0, time: '13:00', kcal: 700 }]);
  await expect(page.getByLabel('Podsumowanie dnia')).toContainText('aby widzieć bilans dnia');
  await page.getByRole('link', { name: 'Ustaw profil w zakładce Waga' }).click();
  await expect(page.getByRole('heading', { name: 'Cel wagi' })).toBeVisible();
});
