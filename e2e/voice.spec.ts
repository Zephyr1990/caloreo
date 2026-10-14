import { expect, test, type Page } from '@playwright/test';
import { analysisMessage, CORS, mockAnthropic, useApiKey } from './helpers';

/** Replaces the browser's speech recognizer with one that "hears" the given phrases. */
async function fakeSpeech(page: Page, phrases: string[]) {
  await page.addInitScript((said: string[]) => {
    type Listener = ((e: unknown) => void) | null;
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: Listener = null;
      onerror: Listener = null;
      onend: (() => void) | null = null;
      private done: { t: string; f: boolean }[] = [];
      start() {
        const w = window as unknown as { __speechLang?: string };
        w.__speechLang = this.lang;
        said.forEach((phrase, i) => {
          setTimeout(() => this.emit([...this.done, { t: phrase.split(' ')[0], f: false }]), 40 + i * 120);
          setTimeout(() => {
            this.done.push({ t: phrase, f: true });
            this.emit(this.done);
          }, 100 + i * 120);
        });
      }
      emit(list: { t: string; f: boolean }[]) {
        const results = list.map((x) => Object.assign([{ transcript: x.t }], { isFinal: x.f }));
        this.onresult?.({ results });
      }
      stop() {
        setTimeout(() => this.onend?.(), 20);
      }
      abort() {
        this.onend?.();
      }
    }
    const w = window as unknown as Record<string, unknown>;
    w.webkitSpeechRecognition = FakeRecognition;
    w.SpeechRecognition = FakeRecognition;
  }, phrases);
}

test('dictates a meal from the day screen and sends it for analysis', async ({ page }) => {
  await useApiKey(page);
  await fakeSpeech(page, ['Na obiad zjadłem schabowego', 'i ziemniaki z koperkiem']);
  let sent = '';
  await mockAnthropic(page, async (route, body) => {
    const content = (body as { messages: { content: { text?: string }[] }[] }).messages[0].content;
    sent = content.at(-1)?.text ?? '';
    await route.fulfill({
      status: 200,
      headers: CORS,
      json: analysisMessage('Schabowy z ziemniakami', [
        { name: 'Kotlet schabowy panierowany', portion: '1 sztuka', grams: 150, kcal: 420, protein_g: 30, fat_g: 26, carbs_g: 16 },
        { name: 'Ziemniaki gotowane z koperkiem', portion: '3 sztuki', grams: 250, kcal: 200, protein_g: 5, fat_g: 0.3, carbs_g: 44 },
      ]),
    });
  });

  await page.goto('./');
  await page.getByRole('button', { name: 'Powiedz, co zjadłeś' }).click();

  await expect(page.getByRole('heading', { name: 'Nowy posiłek' })).toBeVisible();
  await expect(page.getByLabel('Opis (mów lub pisz)')).toHaveValue('Na obiad zjadłem schabowego i ziemniaki z koperkiem');
  await expect(page.getByText('Słucham…')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __speechLang?: string }).__speechLang)).toBe('pl-PL');

  await page.getByRole('button', { name: 'Zakończ nagrywanie' }).click();
  await expect(page.getByText('Dotknij i powiedz, co zjadłeś')).toBeVisible();

  await page.getByRole('button', { name: 'Policz kalorie' }).click();
  await expect(page.getByRole('button', { name: /Zapisz posiłek · 620 kcal/ })).toBeVisible();
  expect(sent).toContain('Opis użytkownika: Na obiad zjadłem schabowego i ziemniaki z koperkiem');
});

test('appends dictation to typed text', async ({ page }) => {
  await fakeSpeech(page, ['i jabłko']);
  await page.goto('./#/add');
  await page.getByLabel('Opis (mów lub pisz)').fill('Banan');
  await page.getByRole('button', { name: 'Zacznij mówić' }).click();
  await expect(page.getByLabel('Opis (mów lub pisz)')).toHaveValue('Banan i jabłko');
});

test('explains what to do when speech recognition is missing', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.webkitSpeechRecognition;
    delete w.SpeechRecognition;
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Powiedz, co zjadłeś' }).click();
  await expect(page.getByText('Użyj mikrofonu na klawiaturze iOS')).toBeVisible();
});
