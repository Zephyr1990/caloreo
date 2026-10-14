import { signal } from '@preact/signals';

export const MODELS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Najtańszy i szybki (domyślny)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Dokładniejszy, droższy' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Najdokładniejszy, najdroższy' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];

export interface Settings {
  apiKey: string;
  model: ModelId;
  /** Daily calorie goal in kcal. */
  dailyGoal: number;
}

/**
 * 2100 kcal: Mifflin-St Jeor for a 36-year-old man, 80 kg, 183 cm (about 1770 kcal at rest)
 * times 1.2 for a mostly sitting lifestyle. Changeable in settings.
 */
export const DEFAULT_GOAL = 2100;

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-haiku-5-5',
  dailyGoal: DEFAULT_GOAL,
};

const STORAGE_KEY = 'caloreo.settings';

export function parseSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (typeof r.apiKey === 'string') s.apiKey = r.apiKey.trim();
    if (MODELS.some((m) => m.id === r.model)) s.model = r.model as ModelId;
    if (typeof r.dailyGoal === 'number' && Number.isFinite(r.dailyGoal) && r.dailyGoal >= 500 && r.dailyGoal <= 10000) {
      s.dailyGoal = Math.round(r.dailyGoal);
    }
  }
  return s;
}

function load(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return parseSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const settings = signal<Settings>(load());

export function updateSettings(patch: Partial<Settings>): void {
  const next = parseSettings({ ...settings.value, ...patch });
  settings.value = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or blocked storage: settings live only for this session.
  }
}
