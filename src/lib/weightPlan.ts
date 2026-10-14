import { addDays, parseDateKey } from './dates';
import type { ActivityEntry, ActivityLevel, Profile, Sex, WeightEntry, WeightPlan } from './types';

/*
 * Weight plan maths. Everything here is a pure function so it can be unit tested.
 * Estimates only: population formulas and common rules of thumb, not medical advice.
 */

/** Rule of thumb: energy in 1 kg of body weight change. */
export const KCAL_PER_KG = 7700;
/** "Base" burn = resting metabolic rate × 1.2: a day without workouts or walks. */
export const BASE_FACTOR = 1.2;

export const LIMITS = {
  /** Max loss per week as a share of the weight at the start of the plan. */
  lossPacePct: 0.01,
  /** Max gain per week as a share of the weight at the start of the plan. */
  gainPacePct: 0.005,
  maxDeficit: 1000,
  maxSurplus: 500,
  minIntake: { male: 1500, female: 1200 } satisfies Record<Sex, number>,
  minBmi: 18.5,
  maxBmi: 30,
  minDays: 7,
} as const;

/** Activity average uses the last N full days and needs at least `ACTIVITY_MIN_DAYS` entries. */
export const ACTIVITY_WINDOW_DAYS = 14;
export const ACTIVITY_MIN_DAYS = 7;

export const ACTIVITY_LEVELS: readonly { id: ActivityLevel; label: string; factor: number }[] = [
  { id: 'sedentary', label: 'Siedzący tryb życia', factor: 1.2 },
  { id: 'light', label: 'Lekka: 1-2 treningi w tygodniu', factor: 1.375 },
  { id: 'moderate', label: 'Umiarkowana: 3-4 treningi', factor: 1.55 },
  { id: 'high', label: 'Duża: 5-6 treningów', factor: 1.725 },
  { id: 'very_high', label: 'Bardzo duża: 7+ lub praca fizyczna', factor: 1.9 },
];

export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_LEVELS.find((l) => l.id === level)?.factor ?? 1.2;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000);
}

export function ageOn(profile: Profile, date: string): number {
  return parseDateKey(date).getFullYear() - profile.birthYear;
}

/** Resting metabolic rate, Mifflin-St Jeor. */
export function bmr(profile: Profile, weightKg: number, date: string): number {
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * ageOn(profile, date);
  return profile.sex === 'male' ? base + 5 : base - 161;
}

export function baseBurn(profile: Profile, weightKg: number, date: string): number {
  return bmr(profile, weightKg, date) * BASE_FACTOR;
}

/** Daily activity calories implied by the declared activity level. */
export function declaredActivityKcal(profile: Profile, weightKg: number, date: string): number {
  return bmr(profile, weightKg, date) * (activityFactor(profile.activity) - BASE_FACTOR);
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface ActivityAverage {
  kcal: number;
  source: 'garmin' | 'declared';
  /** Days with entries in the window. */
  count: number;
}

/**
 * Average daily active calories over the last ACTIVITY_WINDOW_DAYS full days (today excluded).
 * Falls back to the declared activity level until there are ACTIVITY_MIN_DAYS entries.
 */
export function averageActivity(
  entries: readonly ActivityEntry[],
  profile: Profile,
  weightKg: number,
  today: string,
): ActivityAverage {
  const from = addDays(today, -ACTIVITY_WINDOW_DAYS);
  const values = entries
    .filter((e) => e.date >= from && e.date < today && e.activeKcal !== null)
    .map((e) => e.activeKcal as number);
  if (values.length >= ACTIVITY_MIN_DAYS) {
    return { kcal: values.reduce((a, b) => a + b, 0) / values.length, source: 'garmin', count: values.length };
  }
  return { kcal: declaredActivityKcal(profile, weightKg, today), source: 'declared', count: values.length };
}

export type PlanMode = 'loss' | 'maintain' | 'gain';

export type IssueCode =
  | 'date_too_soon'
  | 'pace_too_fast'
  | 'deficit_too_big'
  | 'surplus_too_big'
  | 'intake_too_low'
  | 'target_too_low'
  | 'target_too_high'
  | 'no_room';

export interface Issue {
  code: IssueCode;
  title: string;
  message: string;
  /** Blocking issues cannot be saved as they are, not even with a confirmation. */
  blocking: boolean;
}

export interface Evaluation {
  mode: PlanMode;
  days: number;
  currentWeight: number;
  targetWeight: number;
  /** Positive when losing. */
  changeKg: number;
  /** Absolute kg per week. */
  weeklyKg: number;
  /** Daily need = base + activity. */
  maintenance: number;
  base: number;
  activityKcal: number;
  /** Daily deficit (positive) or surplus (negative). */
  dailyDelta: number;
  /** What to eat per day, rounded to 10 kcal. */
  dailyTarget: number;
  issues: Issue[];
}

export interface PlanInput {
  profile: Profile;
  currentWeight: number;
  targetWeight: number;
  targetDate: string;
  today: string;
  activityKcal: number;
  /** Weight the pace limit is based on; the current weight for a new plan. */
  startWeight?: number;
  /** New plans need a date at least a week away; running plans skip this check. */
  checkDate?: boolean;
}

const EPS = 1e-6;

const fmtKg = (n: number) => String(round1(n)).replace('.', ',');
const fmtKg2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace(/0$/, '').replace('.', ',');
const fmtKcal = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function maxDailyDelta(mode: PlanMode, profile: Profile, maintenance: number, startWeight: number): number {
  if (mode === 'loss') {
    return Math.min(
      LIMITS.maxDeficit,
      (LIMITS.lossPacePct * startWeight * KCAL_PER_KG) / 7,
      maintenance - LIMITS.minIntake[profile.sex],
    );
  }
  if (mode === 'gain') return Math.min(LIMITS.maxSurplus, (LIMITS.gainPacePct * startWeight * KCAL_PER_KG) / 7);
  return 0;
}

export function evaluatePlan(input: PlanInput): Evaluation {
  const { profile, currentWeight, targetWeight, targetDate, today, activityKcal } = input;
  const startWeight = input.startWeight ?? currentWeight;
  const base = baseBurn(profile, currentWeight, today);
  const maintenance = base + activityKcal;
  const days = daysBetween(today, targetDate);
  const changeKg = currentWeight - targetWeight;
  const mode: PlanMode = Math.abs(changeKg) < 0.05 ? 'maintain' : changeKg > 0 ? 'loss' : 'gain';
  const issues: Issue[] = [];

  const dateOk = days >= (input.checkDate === false ? 1 : LIMITS.minDays);
  if (mode !== 'maintain' && !dateOk) {
    issues.push({
      code: 'date_too_soon',
      title: 'Za bliska data',
      message: `Data celu musi być co najmniej ${LIMITS.minDays} dni od dziś.`,
      blocking: true,
    });
  }

  const effDays = Math.max(days, 1);
  const dailyDelta = mode === 'maintain' ? 0 : (changeKg * KCAL_PER_KG) / effDays;
  const weeklyKg = mode === 'maintain' ? 0 : (Math.abs(changeKg) / effDays) * 7;
  const dailyTarget = round10(maintenance - dailyDelta);

  const targetBmi = bmi(targetWeight, profile.heightCm);
  if (mode === 'loss' && targetBmi < LIMITS.minBmi) {
    issues.push({
      code: 'target_too_low',
      title: 'Za niska waga docelowa',
      message: `Ta waga daje BMI ${fmtKg(targetBmi)}, poniżej ${fmtKg(LIMITS.minBmi)}. Najniższa rozsądna waga to ${fmtKg(minHealthyWeight(profile))} kg.`,
      blocking: true,
    });
  }
  if (mode === 'gain' && targetBmi >= LIMITS.maxBmi) {
    issues.push({
      code: 'target_too_high',
      title: 'Za wysoka waga docelowa',
      message: `Ta waga daje BMI ${fmtKg(targetBmi)}, ${LIMITS.maxBmi} lub więcej. Najwyższa rozsądna waga to ${fmtKg(maxHealthyWeight(profile))} kg.`,
      blocking: true,
    });
  }

  if (mode !== 'maintain' && dateOk) {
    const pacePct = mode === 'loss' ? LIMITS.lossPacePct : LIMITS.gainPacePct;
    const paceLimit = pacePct * startWeight;
    if (weeklyKg > paceLimit + EPS) {
      issues.push({
        code: 'pace_too_fast',
        title: 'Za szybkie tempo',
        message: `${fmtKg2(weeklyKg)} kg na tydzień to więcej niż ${mode === 'loss' ? '1%' : '0,5%'} masy ciała (${fmtKg2(paceLimit)} kg).`,
        blocking: false,
      });
    }
    if (mode === 'loss' && dailyDelta > LIMITS.maxDeficit + EPS) {
      issues.push({
        code: 'deficit_too_big',
        title: 'Za duży deficyt',
        message: `Deficyt ${fmtKcal(dailyDelta)} kcal przekracza ${fmtKcal(LIMITS.maxDeficit)} kcal dziennie.`,
        blocking: false,
      });
    }
    if (mode === 'gain' && -dailyDelta > LIMITS.maxSurplus + EPS) {
      issues.push({
        code: 'surplus_too_big',
        title: 'Za duża nadwyżka',
        message: `Nadwyżka ${fmtKcal(-dailyDelta)} kcal przekracza ${LIMITS.maxSurplus} kcal dziennie.`,
        blocking: false,
      });
    }
    const minIntake = LIMITS.minIntake[profile.sex];
    if (mode === 'loss' && dailyTarget < minIntake) {
      issues.push({
        code: 'intake_too_low',
        title: 'Za mało jedzenia',
        message: `Dzienny cel wyszedłby ${fmtKcal(dailyTarget)} kcal, poniżej minimum ${fmtKcal(minIntake)} kcal.`,
        blocking: false,
      });
    }
    if (maxDailyDelta(mode, profile, maintenance, startWeight) <= 0) {
      issues.push({
        code: 'no_room',
        title: 'Brak miejsca na deficyt',
        message: `Przy zapotrzebowaniu ${fmtKcal(maintenance)} kcal nie da się bezpiecznie schudnąć bez jedzenia poniżej ${fmtKcal(minIntake)} kcal. Sprawdź poziom aktywności.`,
        blocking: true,
      });
    }
  }

  return {
    mode,
    days,
    currentWeight,
    targetWeight,
    changeKg,
    weeklyKg,
    maintenance,
    base,
    activityKcal,
    dailyDelta,
    dailyTarget,
    issues,
  };
}

export function minHealthyWeight(profile: Profile): number {
  const m = profile.heightCm / 100;
  return Math.ceil(LIMITS.minBmi * m * m * 10) / 10;
}

export function maxHealthyWeight(profile: Profile): number {
  const m = profile.heightCm / 100;
  return Math.floor((LIMITS.maxBmi * m * m - 0.05) * 10) / 10;
}

export interface Proposal {
  id: 'later' | 'smaller' | 'healthy';
  title: string;
  targetWeight: number;
  targetDate: string;
  evaluation: Evaluation;
}

/** Corrected plans for an evaluation with issues. Empty when nothing sensible can be proposed. */
export function proposePlans(input: PlanInput, ev: Evaluation = evaluatePlan(input)): Proposal[] {
  if (ev.issues.length === 0 || ev.mode === 'maintain') return [];
  const startWeight = input.startWeight ?? input.currentWeight;

  const healthy = ev.issues.find((i) => i.code === 'target_too_low' || i.code === 'target_too_high');
  if (healthy) {
    const targetWeight = healthy.code === 'target_too_low' ? minHealthyWeight(input.profile) : maxHealthyWeight(input.profile);
    const next = { ...input, targetWeight };
    return [{ id: 'healthy', title: 'Rozsądna waga docelowa', targetWeight, targetDate: input.targetDate, evaluation: evaluatePlan(next) }];
  }
  if (ev.issues.some((i) => i.code === 'no_room')) return [];

  const max = maxDailyDelta(ev.mode, input.profile, ev.maintenance, startWeight);
  if (max <= 0) return [];
  const totalKcal = Math.abs(ev.changeKg) * KCAL_PER_KG;
  const out: Proposal[] = [];

  const laterDays = Math.max(LIMITS.minDays, Math.ceil(totalKcal / max - EPS));
  const laterDate = addDays(input.today, laterDays);
  if (laterDays > ev.days) {
    out.push({
      id: 'later',
      title: 'Późniejsza data',
      targetWeight: input.targetWeight,
      targetDate: laterDate,
      evaluation: evaluatePlan({ ...input, targetDate: laterDate }),
    });
  }

  if (ev.days >= LIMITS.minDays) {
    const amount = Math.floor(((max * ev.days) / KCAL_PER_KG) * 10 + EPS) / 10;
    if (amount >= 0.1) {
      const targetWeight = round1(ev.mode === 'loss' ? input.currentWeight - amount : input.currentWeight + amount);
      out.push({
        id: 'smaller',
        title: ev.mode === 'loss' ? 'Mniejszy spadek' : 'Mniejszy przyrost',
        targetWeight,
        targetDate: input.targetDate,
        evaluation: evaluatePlan({ ...input, targetWeight }),
      });
    }
  }
  return out;
}

/** Latest weigh-in on or before `date`, else `fallback`. Entries must be sorted by date. */
export function weightOn(entries: readonly WeightEntry[], date: string, fallback: number): number {
  let w = fallback;
  for (const e of entries) {
    if (e.date > date) break;
    w = e.kg;
  }
  return w;
}

export type PlanState = 'active' | 'reached' | 'expired';

export interface PlanStatus {
  plan: WeightPlan;
  state: PlanState;
  currentWeight: number;
  lastWeighDate: string | null;
  activity: ActivityAverage;
  evaluation: Evaluation;
  /** What to eat today. Kept within the thresholds unless the plan was accepted as unsafe. */
  dailyTarget: number;
  /** Deficit (positive) or surplus (negative) behind `dailyTarget`. */
  dailyDelta: number;
  clamped: boolean;
  daysLeft: number;
  /** Weight change done so far towards the target (kg, in the plan's direction). */
  doneKg: number;
  totalKg: number;
  progress: number;
  /** Current minus expected weight on a straight line from start to target (kg). */
  offTrackKg: number;
  /** A later target date that fits the thresholds, when today's numbers do not. */
  suggestion: Proposal | null;
}

export function planStatus(input: {
  profile: Profile;
  plan: WeightPlan;
  weights: readonly WeightEntry[];
  activity: readonly ActivityEntry[];
  today: string;
}): PlanStatus {
  const { profile, plan, weights, activity, today } = input;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const currentWeight = weightOn(sorted, today, plan.startWeight);
  const lastWeigh = sorted.filter((w) => w.date <= today).at(-1)?.date ?? null;
  const avg = averageActivity(activity, profile, currentWeight, today);
  const losing = plan.targetWeight < plan.startWeight;
  const totalKg = Math.abs(plan.startWeight - plan.targetWeight);
  const doneKg = losing ? plan.startWeight - currentWeight : currentWeight - plan.startWeight;
  const totalDays = Math.max(1, daysBetween(plan.startDate, plan.targetDate));
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(plan.startDate, today)));
  const expected = plan.startWeight + (plan.targetWeight - plan.startWeight) * (elapsed / totalDays);
  const daysLeft = daysBetween(today, plan.targetDate);

  const evaluation = evaluatePlan({
    profile,
    currentWeight,
    targetWeight: plan.targetWeight,
    targetDate: plan.targetDate,
    today,
    activityKcal: avg.kcal,
    startWeight: plan.startWeight,
    checkDate: false,
  });

  const reached = totalKg > 0 && doneKg >= totalKg - 0.05;
  const state: PlanState = reached ? 'reached' : daysLeft <= 0 ? 'expired' : 'active';
  const maintenanceTarget = round10(evaluation.maintenance);

  let dailyDelta = state === 'active' ? evaluation.dailyDelta : 0;
  let clamped = false;
  let suggestion: Proposal | null = null;
  if (state === 'active' && !plan.acceptedUnsafe && evaluation.issues.length > 0 && evaluation.mode !== 'maintain') {
    const max = Math.max(0, maxDailyDelta(evaluation.mode, profile, evaluation.maintenance, plan.startWeight));
    const limited = evaluation.mode === 'loss' ? Math.min(dailyDelta, max) : Math.max(dailyDelta, -max);
    clamped = limited !== dailyDelta;
    dailyDelta = limited;
    suggestion =
      proposePlans(
        {
          profile,
          currentWeight,
          targetWeight: plan.targetWeight,
          targetDate: plan.targetDate,
          today,
          activityKcal: avg.kcal,
          startWeight: plan.startWeight,
          checkDate: false,
        },
        evaluation,
      ).find((p) => p.id === 'later') ?? null;
  }

  return {
    plan,
    state,
    currentWeight,
    lastWeighDate: lastWeigh,
    activity: avg,
    evaluation,
    dailyTarget: state === 'active' ? round10(evaluation.maintenance - dailyDelta) : maintenanceTarget,
    dailyDelta,
    clamped,
    daysLeft,
    doneKg,
    totalKg,
    progress: totalKg > 0 ? Math.min(1, Math.max(0, doneKg / totalKg)) : 1,
    offTrackKg: currentWeight - expected,
    suggestion,
  };
}

export interface DayBalance {
  date: string;
  eaten: number;
  base: number;
  activeKcal: number | null;
  /** null until active calories are entered for the day. */
  burned: number | null;
  /** burned − eaten: positive is a deficit. */
  balance: number | null;
}

export function dayBalance(
  profile: Profile,
  weightKg: number,
  date: string,
  eaten: number,
  activity: ActivityEntry | undefined,
): DayBalance {
  const base = baseBurn(profile, weightKg, date);
  const activeKcal = activity?.activeKcal ?? null;
  const burned = activeKcal === null ? null : base + activeKcal;
  return { date, eaten, base, activeKcal, burned, balance: burned === null ? null : burned - eaten };
}

export interface BalanceSummary {
  /** Average balance over the last 7 full days that have meals and activity. */
  avg7: number | null;
  count7: number;
  /** Sum of balances since the plan start (full days with data). */
  sum: number;
  countSum: number;
  /** sum / KCAL_PER_KG */
  kgEstimate: number;
}

/** `days` should be full days (today excluded) that have meals logged. */
export function summarizeBalance(days: readonly DayBalance[], today: string, since: string): BalanceSummary {
  const withData = days.filter((d) => d.balance !== null && d.date < today && d.eaten > 0);
  const last7 = withData.filter((d) => d.date >= addDays(today, -7));
  const sinceStart = withData.filter((d) => d.date >= since);
  const sum = sinceStart.reduce((s, d) => s + (d.balance as number), 0);
  return {
    avg7: last7.length ? last7.reduce((s, d) => s + (d.balance as number), 0) / last7.length : null,
    count7: last7.length,
    sum,
    countSum: sinceStart.length,
    kgEstimate: sum / KCAL_PER_KG,
  };
}
