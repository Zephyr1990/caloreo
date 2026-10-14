import { expect, test } from '@playwright/test';
import { dateKey, seedActivity, seedMeals, useBody } from './helpers';

test('a too fast plan gets two proposals; accepting one sets the daily goal', async ({ page }) => {
  await page.goto('./#/weight');
  await page.getByRole('link', { name: 'Ustaw cel wagi' }).click();
  await expect(page.getByRole('heading', { name: 'Cel wagi' })).toBeVisible();

  // Pre-filled profile: man, 183 cm, high activity.
  await expect(page.getByRole('button', { name: 'Mężczyzna' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Wzrost (cm)')).toHaveValue('183');
  await expect(page.getByLabel('Aktywność (na start)')).toHaveValue('high');

  await page.getByLabel('Waga teraz (kg)').fill('80');
  await page.getByLabel('Waga docelowa (kg)').fill('72');
  await page.getByLabel('Data celu').fill(dateKey(-47));

  await expect(page.getByText('Tryb: redukcja')).toBeVisible();
  await expect(page.getByText('Za szybkie tempo')).toBeVisible();
  await expect(page.getByText('Za duży deficyt')).toBeVisible();
  await expect(page.getByText('A · Późniejsza data')).toBeVisible();
  await expect(page.getByText('B · Mniejszy spadek')).toBeVisible();
  await expect(page.getByText('74,7 kg', { exact: false })).toBeVisible();

  await page.getByText('A · Późniejsza data').click();
  await page.getByRole('button', { name: 'Zapisz plan A' }).click();

  await expect(page.getByRole('heading', { name: 'Waga' })).toBeVisible();
  await expect(page.getByText(/Redukcja: 72,0 kg do/)).toBeVisible();
  await expect(page.getByText('Zgodnie z planem')).toBeVisible();
  const goal = (await page.locator('.stat-value').first().textContent())!.trim();
  expect(goal).toMatch(/kcal$/);
  // Today's weight was recorded when saving the plan.
  await expect(page.getByLabel('Dzisiejsza waga (kg)')).toHaveValue('80,0');

  await page.getByRole('link', { name: 'Dziś' }).click();
  await expect(page.getByLabel('Podsumowanie dnia')).toContainText(`/ ${goal}`);
  await expect(page.getByRole('link', { name: /Cel z planu wagi: 72,0 kg/ })).toBeVisible();
});

test('the user can keep their own plan despite a warning', async ({ page }) => {
  await page.goto('./#/weight/plan');
  await page.getByLabel('Waga teraz (kg)').fill('80');
  await page.getByLabel('Waga docelowa (kg)').fill('72');
  await page.getByLabel('Data celu').fill(dateKey(-47));
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Zapisz mój plan mimo ostrzeżenia' }).click();
  await expect(page.getByText(/Redukcja: 72,0 kg do/)).toBeVisible();
  await expect(page.getByText('Plan wymaga za szybkiego tempa')).toHaveCount(0);
});

test('blocks a target weight below a healthy BMI and proposes one', async ({ page }) => {
  await page.goto('./#/weight/plan');
  await page.getByLabel('Waga teraz (kg)').fill('80');
  await page.getByLabel('Waga docelowa (kg)').fill('55');
  await page.getByLabel('Data celu').fill(dateKey(-365));
  await expect(page.getByText('Za niska waga docelowa')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zapisz mój plan mimo ostrzeżenia' })).toHaveCount(0);
  await expect(page.getByText('A · Rozsądna waga docelowa')).toBeVisible();
  await expect(page.getByText('62,0 kg', { exact: false })).toBeVisible();
});

test('plans weight gain', async ({ page }) => {
  await page.goto('./#/weight/plan');
  await page.getByLabel('Waga teraz (kg)').fill('80');
  await page.getByLabel('Waga docelowa (kg)').fill('83');
  await page.getByLabel('Data celu').fill(dateKey(-120));
  await expect(page.getByText('Tryb: przybieranie')).toBeVisible();
  await expect(page.getByText(/Plan mieści się w progach/)).toBeVisible();
  await expect(page.getByText('Potrzebna nadwyżka')).toBeVisible();
  await page.getByRole('button', { name: 'Zapisz plan' }).click();
  await expect(page.getByText(/Przybieranie: 83,0 kg do/)).toBeVisible();
});

test('a weigh-in updates the plan and the list', async ({ page }) => {
  await useBody(page, { startDaysAgo: 7, startWeight: 80, targetWeight: 74, targetInDays: 70 });
  await page.goto('./#/weight');
  await page.getByLabel('Dzisiejsza waga (kg)').fill('79,4');
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await expect(page.getByLabel('Postęp planu')).toContainText('79,4');
  await expect(page.getByText('Schudłeś 0,6 kg')).toBeVisible();
  await expect(page.getByLabel('Pomiary')).toContainText('79,4 kg');
});

test('activity entered the next day gives the day balance and clears the reminder', async ({ page }) => {
  await useBody(page, { startDaysAgo: 10, startWeight: 80, targetWeight: 74, targetInDays: 70 });
  await page.goto('./');
  await seedMeals(page, [{ id: 'y1', name: 'Obiad wczoraj', daysAgo: 1, time: '13:00', kcal: 1500 }]);
  await seedActivity(page, [{ daysAgo: 2, activeKcal: 650 }]);

  await page.getByRole('link', { name: 'Uzupełnij aktywność z wczoraj' }).click();
  await expect(page.getByRole('heading', { name: 'Wczoraj' })).toBeVisible();
  await expect(page.getByText('Wpisz kalorie aktywne, aby zobaczyć bilans dnia.')).toBeVisible();

  await page.getByLabel('Kalorie aktywne').fill('700');
  await page.getByLabel('Kroki (opcjonalnie)').fill('11000');
  await page.getByRole('button', { name: 'Zapisz aktywność' }).click();
  await expect(page.getByRole('button', { name: 'Zapisano' })).toBeVisible();

  // Base for a 36-year-old man, 80 kg, 183 cm: 1768,75 × 1,2 = 2122,5 kcal.
  const balance = page.getByLabel('Bilans dnia');
  await expect(balance).toContainText('2 123 kcal');
  await expect(balance).toContainText('+ 700 kcal');
  await expect(balance).toContainText('Deficyt dnia');
  await expect(balance).toContainText('1 323 kcal');

  await page.getByRole('button', { name: 'Następny dzień' }).click();
  await expect(page.getByRole('heading', { name: 'Dziś' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Uzupełnij aktywność z wczoraj' })).toHaveCount(0);
});

test('the weight tab shows the real deficit against the plan', async ({ page }) => {
  await useBody(page, { startDaysAgo: 10, startWeight: 80, targetWeight: 74, targetInDays: 70 });
  await page.goto('./');
  await seedMeals(
    page,
    [1, 2, 3, 4, 5].map((d) => ({ id: `m${d}`, name: `Dzień ${d}`, daysAgo: d, time: '13:00', kcal: 2000 })),
  );
  await seedActivity(page, [1, 2, 3, 4, 5].map((d) => ({ daysAgo: d, activeKcal: 700 })));
  await page.getByRole('link', { name: 'Waga' }).click();
  const card = page.getByLabel('Bilans');
  await expect(card).toContainText('Średni deficyt, 7 dni');
  await expect(card).toContainText('Od startu (5 dni z danymi)');
  // 2122,5 + 700 − 2000 = 822,5 kcal a day; 5 days ≈ 4 113 kcal ≈ 0,5 kg.
  await expect(card).toContainText('823 kcal');
  await expect(card).toContainText('4 113 kcal');
});

test('settings switch the calorie goal between the plan and a manual value', async ({ page }) => {
  await useBody(page, { startDaysAgo: 0, startWeight: 80, targetWeight: 74, targetInDays: 70 });
  await page.goto('./#/settings');
  const fromPlan = page.getByRole('radio', { name: /Z planu wagi/ });
  await expect(fromPlan).toBeChecked();
  await page.getByRole('radio', { name: 'Ręcznie' }).check();
  await page.getByLabel('Dzienny cel kalorii').fill('2000');
  await page.getByRole('link', { name: 'Dziś' }).click();
  await expect(page.getByLabel('Podsumowanie dnia')).toContainText('/ 2 000 kcal');
  await expect(page.getByRole('link', { name: /Cel z planu wagi/ })).toHaveCount(0);
});
