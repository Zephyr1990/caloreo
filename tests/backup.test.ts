import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { backupFileName, BackupError, buildBackup, importBackup, parseBackup } from '../src/lib/backup';
import { body, updateBody } from '../src/lib/body';
import { allActivity, allMeals, allWeights, clearAllData, closeDb } from '../src/lib/db';
import { settings, updateSettings } from '../src/lib/settings';
import type { Meal } from '../src/lib/types';

const MEAL: Meal = {
  id: 'm1',
  name: 'Owsianka',
  type: 'breakfast',
  date: '2026-10-14',
  time: '07:30',
  description: 'owsianka z jabłkiem',
  items: [{ id: 'i1', name: 'Płatki owsiane', portion: '60 g', grams: 60, kcal: 220, protein: 8, fat: 4, carbs: 36 }],
  notes: '',
  confidence: 'high',
  source: 'ai',
  model: 'claude-haiku-5-5',
  thumbnail: null,
  createdAt: '2026-10-14T05:30:00.000Z',
  updatedAt: '2026-10-14T05:30:00.000Z',
};

afterEach(async () => {
  await clearAllData();
  await closeDb();
});

describe('backup', () => {
  it('round-trips meals and settings without the API key', () => {
    const text = buildBackup({ meals: [MEAL] }, { apiKey: 'sk-secret', model: 'claude-opus-5-5', dailyGoal: 1900 } as never);
    expect(text).not.toContain('sk-secret');
    const parsed = parseBackup(text);
    expect(parsed.meals).toEqual([MEAL]);
    expect(parsed.settings).toEqual({ model: 'claude-opus-5-5', dailyGoal: 1900, hiddenFrequent: [] });
  });

  it('round-trips meals added from suggestions and the hidden suggestions (version 3)', async () => {
    const frequent = { ...MEAL, id: 'f1', source: 'frequent' as const };
    updateSettings({ hiddenFrequent: ['item:banan'] });
    const text = buildBackup({ meals: [frequent] }, { model: 'claude-haiku-5-5', dailyGoal: 2100, hiddenFrequent: ['item:kawa'] });
    expect(parseBackup(text).meals).toEqual([frequent]);
    await importBackup(new Blob([text]));
    expect(settings.value.hiddenFrequent).toEqual(['item:banan', 'item:kawa']);
    updateSettings({ hiddenFrequent: [] });
  });

  it('rejects files that are not Caloreo backups', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other","version":1,"exportedAt":"","meals":[]}')).toThrow('nie jest plik kopii');
    expect(() => parseBackup(JSON.stringify({ app: 'caloreo', version: 1, exportedAt: '', meals: [{ id: 1 }] }))).toThrow(
      BackupError,
    );
    expect(() => parseBackup(JSON.stringify({ app: 'caloreo', version: 99, exportedAt: '', meals: [] }))).toThrow('nowszej wersji');
  });

  it('ignores unknown models from a backup', () => {
    const text = JSON.stringify({ app: 'caloreo', version: 1, exportedAt: '', settings: { model: 'gpt-x' }, meals: [] });
    expect(parseBackup(text).settings.model).toBeUndefined();
  });

  it('imports meals into the database and applies settings', async () => {
    updateSettings({ dailyGoal: 2100 });
    const count = await importBackup(new Blob([buildBackup({ meals: [MEAL] }, { model: 'claude-haiku-5-5', dailyGoal: 1800 })]));
    expect(count).toBe(1);
    expect(await allMeals()).toEqual([MEAL]);
    expect(settings.value.dailyGoal).toBe(1800);
  });

  it('round-trips weigh-ins, activity, profile and plan (version 2)', async () => {
    const plan = { startDate: '2026-10-14', startWeight: 80, targetWeight: 72, targetDate: '2026-12-23', acceptedUnsafe: false, createdAt: '' };
    const data = {
      meals: [MEAL],
      weights: [{ date: '2026-10-14', kg: 80, updatedAt: '' }],
      activity: [{ date: '2026-10-14', activeKcal: 700, steps: 11000, updatedAt: '' }],
      body: { profile: { sex: 'male' as const, birthYear: 1990, heightCm: 183, activity: 'high' as const }, plan, goalSource: 'plan' as const },
    };
    updateBody({ profile: null, plan: null, goalSource: 'manual' });
    await importBackup(new Blob([buildBackup(data, { model: 'claude-haiku-5-5', dailyGoal: 2100 })]));
    expect(await allWeights()).toEqual(data.weights);
    expect(await allActivity()).toEqual(data.activity);
    expect(body.value).toEqual(data.body);
  });

  it('still reads version 1 backups', () => {
    const v1 = JSON.stringify({ app: 'caloreo', version: 1, exportedAt: '', settings: { dailyGoal: 2000 }, meals: [MEAL] });
    const parsed = parseBackup(v1);
    expect(parsed.meals).toEqual([MEAL]);
    expect(parsed.weights).toEqual([]);
    expect(parsed.activity).toEqual([]);
    expect(parsed.body).toBeNull();
  });

  it('names the file with the date', () => {
    expect(backupFileName('2026-10-14')).toBe('caloreo-kopia-2026-10-14.json');
  });
});
