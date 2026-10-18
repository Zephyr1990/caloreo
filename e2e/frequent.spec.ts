import { expect, test, type Page } from '@playwright/test';
import { analysisMessage, CORS, mockAnthropic, seedMeals, useApiKey } from './helpers';

// Quick add shows only what was eaten around the current time, so seeded meals use the page's clock.
const nowInPage = (page: Page) => page.evaluate(() => new Date().toTimeString().slice(0, 5));

const cappuccino = (daysAgo: number, time = '08:00') => ({
  id: `c${daysAgo}`,
  name: '',
  daysAgo,
  time,
  kcal: 110,
  type: 'breakfast',
  items: [{ name: 'Cappuccino', kcal: 110, portion: '250 ml' }],
});
const banana = (daysAgo: number, time = '11:00') => ({ id: `b${daysAgo}`, name: 'Banan', daysAgo, time, kcal: 105, type: 'second_breakfast' });

test('a food eaten 3 times shows in quick add and opens a preview before saving', async ({ page }) => {
  await page.goto('./');
  const now = await nowInPage(page);
  await seedMeals(page, [
    ...[1, 2, 3].map((d) => cappuccino(d, now)),
    { id: 's1', name: 'Serek wiejski', daysAgo: 1, time: now, kcal: 190 },
    { id: 's2', name: 'Serek wiejski', daysAgo: 2, time: now, kcal: 190 },
  ]);

  const quick = page.getByRole('region', { name: 'Szybko dodaj' });
  await expect(quick.getByRole('button', { name: /^Cappuccino, 250 ml, 110 kcal$/ })).toBeVisible();
  // Twice in 60 days is below the threshold.
  await expect(quick).not.toContainText('Serek wiejski');

  await quick.getByRole('button', { name: /Cappuccino/ }).click();
  await expect(page.getByRole('heading', { name: 'Sprawdź i zapisz' })).toBeVisible();
  await page.getByRole('button', { name: /Zapisz posiłek · 110 kcal/ }).click();

  await expect(page.getByRole('heading', { name: 'Dziś' })).toBeVisible();
  const row = page.getByRole('link', { name: /Cappuccino/ });
  await expect(row).toContainText('z podpowiedzi');
  await expect(page.getByLabel('Podsumowanie dnia')).toContainText('110');
  await expect(quick.getByRole('button', { name: /Cappuccino/ })).toContainText('dziś już jest');
});

test('frequent foods can be picked for a new meal and combined with an AI estimate', async ({ page }) => {
  await useApiKey(page);
  const bodies: Record<string, unknown>[] = [];
  await mockAnthropic(page, async (route, body) => {
    bodies.push(body);
    const eggs = { name: 'Jajecznica z 2 jaj', portion: '2 jajka', grams: 120, kcal: 200, protein_g: 13, fat_g: 16, carbs_g: 1 };
    await route.fulfill({ status: 200, headers: CORS, json: analysisMessage('Jajecznica', [eggs]) });
  });
  await page.goto('./');
  await seedMeals(
    page,
    [1, 2, 3].map((d) => ({
      id: `o${d}`,
      name: 'Owsianka z bananem',
      daysAgo: d,
      time: '07:30',
      kcal: 0,
      type: 'breakfast',
      items: [
        { name: 'Owsianka', kcal: 300 },
        { name: 'Banan', kcal: 105 },
      ],
    })),
  );

  await page.getByRole('button', { name: 'Wpisz posiłek ręcznie' }).click();
  await page.getByRole('button', { name: 'Śniadanie', exact: true }).click();
  const picker = page.getByRole('region', { name: 'Częste przy śniadaniu' });
  await expect(picker.getByRole('button', { name: 'Owsianka z bananem · 405' })).toBeVisible();
  await picker.getByRole('button', { name: 'Banan · 105' }).click();
  await expect(picker).toContainText('Wybrane: 1 · 105 kcal');
  await expect(page.getByRole('button', { name: 'Dalej z wybranymi · 105 kcal' })).toBeVisible();

  await page.getByLabel('Coś jeszcze? (mów lub pisz)').fill('jajecznica z 2 jaj');
  await page.getByRole('button', { name: 'Policz kalorie' }).click();
  await expect(page.getByRole('heading', { name: 'Sprawdź i zapisz' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Zapisz posiłek · 305 kcal/ })).toBeVisible();

  const text = (bodies[0] as { messages: { content: { text?: string }[] }[] }).messages[0].content.at(-1)?.text ?? '';
  expect(text).toContain('Nazwy produktów, których użytkownik już używa:');
  expect(text).toContain('"Owsianka"');
  expect(text).toContain('"Banan"');
});

test('picking only frequent foods skips the AI', async ({ page }) => {
  await page.goto('./');
  await seedMeals(page, [1, 2, 3].map((d) => cappuccino(d)));
  await page.getByRole('button', { name: 'Wpisz posiłek ręcznie' }).click();
  await page.getByRole('button', { name: 'Śniadanie', exact: true }).click();
  await page.getByRole('button', { name: 'Cappuccino · 110' }).click();
  await page.getByRole('button', { name: 'Dalej z wybranymi · 110 kcal' }).click();
  await expect(page.getByRole('heading', { name: 'Sprawdź i zapisz' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Zapisz posiłek · 110 kcal/ })).toBeVisible();
});

test('the full list can hide and restore a suggestion', async ({ page }) => {
  await page.goto('./');
  const now = await nowInPage(page);
  await seedMeals(page, [...[1, 2, 3].map((d) => cappuccino(d, now)), ...[1, 2, 3].map((d) => banana(d, now))]);

  await page.getByRole('region', { name: 'Szybko dodaj' }).getByRole('link', { name: 'Wszystkie' }).click();
  await expect(page.getByRole('heading', { name: 'Wszystkie częste' })).toBeVisible();
  const products = page.getByRole('region', { name: 'Produkty' });
  await expect(products).toContainText(/250 ml · 110 kcal · 3 razy · ok\. \d{1,2}:\d{2}/);

  await page.getByRole('button', { name: 'Ukryj: Cappuccino' }).click();
  await expect(products).not.toContainText('Cappuccino');
  await page.getByRole('button', { name: 'Ukryte: 1 · Pokaż' }).click();
  await expect(page.getByRole('region', { name: 'Ukryte' })).toContainText('Cappuccino');

  await page.getByRole('button', { name: 'Wróć', exact: true }).click();
  const quick = page.getByRole('region', { name: 'Szybko dodaj' });
  await expect(quick).toContainText('Banan');
  await expect(quick).not.toContainText('Cappuccino');

  await quick.getByRole('link', { name: 'Wszystkie' }).click();
  await page.getByRole('button', { name: 'Ukryte: 1 · Pokaż' }).click();
  await page.getByRole('button', { name: 'Przywróć: Cappuccino' }).click();
  await expect(products).toContainText('Cappuccino');

  await page.getByRole('button', { name: 'Dodaj: Banan' }).click();
  await expect(page.getByRole('heading', { name: 'Sprawdź i zapisz' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Zapisz posiłek · 105 kcal/ })).toBeVisible();
});

test('nothing is suggested before something repeats', async ({ page }) => {
  await page.goto('./');
  const now = await nowInPage(page);
  await seedMeals(page, [cappuccino(1, now), cappuccino(2, now)]);
  await expect(page.getByRole('heading', { name: 'Posiłki' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Szybko dodaj' })).toHaveCount(0);
});
