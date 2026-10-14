import { z } from 'zod';
import { allMeals, saveMeals } from './db';
import { todayKey } from './dates';
import { MODELS, settings, updateSettings, type ModelId } from './settings';
import type { Meal } from './types';

export const BACKUP_VERSION = 1;

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
  source: z.enum(['ai', 'manual']),
  model: z.string().nullable(),
  thumbnail: z.string().nullable(),
  createdAt: z.string(),
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
    })
    .optional(),
  meals: z.array(MealSchema),
});

export interface Backup {
  meals: Meal[];
  settings: { model?: ModelId; dailyGoal?: number };
}

export class BackupError extends Error {}

/** The API key is never part of a backup. */
export function buildBackup(meals: readonly Meal[], s: { model: string; dailyGoal: number }, now = new Date()): string {
  return JSON.stringify(
    {
      app: 'caloreo',
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      settings: { model: s.model, dailyGoal: s.dailyGoal },
      meals,
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
    settings: {
      model: MODELS.some((m) => m.id === s.model) ? (s.model as ModelId) : undefined,
      dailyGoal: s.dailyGoal,
    },
  };
}

export function backupFileName(date: string = todayKey()): string {
  return `caloreo-kopia-${date}.json`;
}

/** Saves a backup file. On iPhone this opens the share sheet ("Zachowaj w Plikach"). */
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const text = buildBackup(await allMeals(), settings.value);
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
  const patch: Parameters<typeof updateSettings>[0] = {};
  if (backup.settings.model) patch.model = backup.settings.model;
  if (backup.settings.dailyGoal) patch.dailyGoal = backup.settings.dailyGoal;
  updateSettings(patch);
  return backup.meals.length;
}
