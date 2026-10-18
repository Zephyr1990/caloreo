import { z } from 'zod';
import { body, parseBody, updateBody, type BodySettings } from './body';
import { allActivity, allMeals, allWeights, saveBodyData, saveMeals } from './db';
import { todayKey } from './dates';
import { MODELS, settings, updateSettings, type ModelId } from './settings';
import type { ActivityEntry, Meal, WeightEntry } from './types';

/**
 * 1: meals and settings. 2: also weigh-ins, activity, profile and weight plan.
 * 3: meals added from frequent suggestions and the hidden suggestions.
 */
export const BACKUP_VERSION = 3;

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  portion: z.string(),
  grams: z.number(),
  kcal: z.number(),
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
});

const MealSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['breakfast', 'second_breakfast', 'lunch', 'afternoon_snack', 'dinner', 'snack']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  description: z.string(),
  items: z.array(ItemSchema),
  notes: z.string(),
  confidence: z.enum(['low', 'medium', 'high']).nullable(),
  source: z.enum(['ai', 'manual', 'frequent']),
  model: z.string().nullable(),
  thumbnail: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const WeightSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kg: z.number(),
  updatedAt: z.string(),
});

const ActivitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activeKcal: z.number().nullable(),
  steps: z.number().nullable(),
  updatedAt: z.string(),
});

const BackupSchema = z.object({
  app: z.literal('caloreo'),
  version: z.number(),
  exportedAt: z.string(),
  settings: z
    .object({
      model: z.string().optional(),
      dailyGoal: z.number().optional(),
      hiddenFrequent: z.array(z.string()).optional(),
    })
    .optional(),
  meals: z.array(MealSchema),
  weights: z.array(WeightSchema).optional(),
  activity: z.array(ActivitySchema).optional(),
  body: z.unknown().optional(),
});

export interface Backup {
  meals: Meal[];
  weights: WeightEntry[];
  activity: ActivityEntry[];
  /** null for version 1 backups, which had no profile or plan. */
  body: BodySettings | null;
  settings: { model?: ModelId; dailyGoal?: number; hiddenFrequent?: string[] };
}

export interface BackupData {
  meals: readonly Meal[];
  weights?: readonly WeightEntry[];
  activity?: readonly ActivityEntry[];
  body?: BodySettings;
}

export class BackupError extends Error {}

/** The API key is never part of a backup. */
export function buildBackup(
  data: BackupData,
  s: { model: string; dailyGoal: number; hiddenFrequent?: readonly string[] },
  now = new Date(),
): string {
  return JSON.stringify(
    {
      app: 'caloreo',
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      settings: { model: s.model, dailyGoal: s.dailyGoal, hiddenFrequent: s.hiddenFrequent ?? [] },
      meals: data.meals,
      weights: data.weights ?? [],
      activity: data.activity ?? [],
      body: data.body ?? null,
    },
    null,
    1,
  );
}

export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('To nie jest plik kopii Caloreo (niepoprawny JSON).');
  }
  const result = BackupSchema.safeParse(json);
  if (!result.success) {
    throw new BackupError('To nie jest plik kopii Caloreo albo plik jest uszkodzony.');
  }
  if (result.data.version > BACKUP_VERSION) {
    throw new BackupError('Ta kopia pochodzi z nowszej wersji aplikacji. Zaktualizuj aplikację.');
  }
  const s = result.data.settings ?? {};
  return {
    meals: result.data.meals,
    weights: result.data.weights ?? [],
    activity: result.data.activity ?? [],
    body: result.data.body ? parseBody(result.data.body) : null,
    settings: {
      model: MODELS.some((m) => m.id === s.model) ? (s.model as ModelId) : undefined,
      dailyGoal: s.dailyGoal,
      hiddenFrequent: s.hiddenFrequent,
    },
  };
}

export function backupFileName(date: string = todayKey()): string {
  return `caloreo-kopia-${date}.json`;
}

/** Saves a backup file. On iPhone this opens the share sheet ("Zachowaj w Plikach"). */
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const [meals, weights, activity] = await Promise.all([allMeals(), allWeights(), allActivity()]);
  const text = buildBackup({ meals, weights, activity, body: body.value }, settings.value);
  const name = backupFileName();
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Kopia Caloreo' });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Fall back to a download below.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** Adds the meals from a backup; meals with the same id are replaced. Returns how many were imported. */
export async function importBackup(file: Blob): Promise<number> {
  const backup = parseBackup(await file.text());
  await saveMeals(backup.meals);
  await saveBodyData(backup.weights, backup.activity);
  if (backup.body) updateBody(backup.body);
  const patch: Parameters<typeof updateSettings>[0] = {};
  if (backup.settings.model) patch.model = backup.settings.model;
  if (backup.settings.dailyGoal) patch.dailyGoal = backup.settings.dailyGoal;
  if (backup.settings.hiddenFrequent?.length) {
    patch.hiddenFrequent = [...settings.value.hiddenFrequent, ...backup.settings.hiddenFrequent];
  }
  updateSettings(patch);
  return backup.meals.length;
}
