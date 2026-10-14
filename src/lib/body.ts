import { signal } from '@preact/signals';
import { ACTIVITY_LEVELS } from './weightPlan';
import type { ActivityLevel, Profile, WeightPlan } from './types';

/** Profile, weight plan and where the daily calorie goal comes from. Stored like settings. */
export interface BodySettings {
  profile: Profile | null;
  plan: WeightPlan | null;
  goalSource: 'plan' | 'manual';
}

export const DEFAULT_BODY: BodySettings = { profile: null, plan: null, goalSource: 'manual' };

/** Pre-filled profile for the first plan: 36-year-old man, 183 cm, 5 workouts a week. */
export const DEFAULT_PROFILE: Profile = { sex: 'male', birthYear: 1990, heightCm: 183, activity: 'high' };

const STORAGE_KEY = 'caloreo.body';

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

export function parseProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.sex !== 'male' && r.sex !== 'female') return null;
  if (!isNum(r.birthYear, 1900, 2100) || !isNum(r.heightCm, 100, 250)) return null;
  if (!ACTIVITY_LEVELS.some((l) => l.id === r.activity)) return null;
  return { sex: r.sex, birthYear: Math.round(r.birthYear), heightCm: r.heightCm, activity: r.activity as ActivityLevel };
}

export function parsePlan(raw: unknown): WeightPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isDate(r.startDate) || !isDate(r.targetDate)) return null;
  if (!isNum(r.startWeight, 20, 400) || !isNum(r.targetWeight, 20, 400)) return null;
  return {
    startDate: r.startDate,
    startWeight: r.startWeight,
    targetWeight: r.targetWeight,
    targetDate: r.targetDate,
    acceptedUnsafe: r.acceptedUnsafe === true,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
  };
}

export function parseBody(raw: unknown): BodySettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BODY };
  const r = raw as Record<string, unknown>;
  const plan = parsePlan(r.plan);
  return {
    profile: parseProfile(r.profile),
    plan,
    goalSource: r.goalSource === 'plan' && plan ? 'plan' : 'manual',
  };
}

function load(): BodySettings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return parseBody(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_BODY };
  }
}

export const body = signal<BodySettings>(load());

export function updateBody(patch: Partial<BodySettings>): void {
  const next = parseBody({ ...body.value, ...patch });
  body.value = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Blocked storage: keep the values for this session only.
  }
}
