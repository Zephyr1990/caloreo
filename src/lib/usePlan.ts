import { useEffect, useState } from 'preact/hooks';
import { body, type BodySettings } from './body';
import { addDays, todayKey } from './dates';
import { allActivity, allWeights, bodyVersion, mealsInRange, mealsVersion } from './db';
import { sumItems } from './nutrition';
import { settings } from './settings';
import type { ActivityEntry, Meal, Profile, WeightEntry } from './types';
import { dayBalance, planStatus, summarizeBalance, weightOn, type BalanceSummary, type PlanStatus } from './weightPlan';

export interface BodyData {
  weights: WeightEntry[];
  activity: ActivityEntry[];
}

/** All weigh-ins and activity days; reloads after every change. */
export function useBodyData(): BodyData | null {
  const version = bodyVersion.value;
  const [data, setData] = useState<BodyData | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([allWeights(), allActivity()]).then(([weights, activity]) => {
      if (alive) setData({ weights, activity });
    });
    return () => {
      alive = false;
    };
  }, [version]);
  return data;
}

export function statusFor(b: BodySettings, data: BodyData | null, today: string = todayKey()): PlanStatus | null {
  if (!b.profile || !b.plan || !data) return null;
  return planStatus({ profile: b.profile, plan: b.plan, weights: data.weights, activity: data.activity, today });
}

export interface Goal {
  /** Daily calorie goal to show. */
  goal: number;
  fromPlan: boolean;
  status: PlanStatus | null;
  data: BodyData | null;
}

/** The daily calorie goal: from the weight plan when it is the chosen source, else the manual value. */
export function useGoal(): Goal {
  const data = useBodyData();
  const b = body.value;
  const status = statusFor(b, data);
  const fromPlan = b.goalSource === 'plan' && status !== null;
  return { goal: fromPlan ? status.dailyTarget : settings.value.dailyGoal, fromPlan, status, data };
}

/** Balance of the full days with meals and Garmin data: the last 7 days and since the plan start. */
export function useBalanceSummary(
  profile: Profile | null,
  status: PlanStatus | null,
  data: BodyData | null,
  today: string = todayKey(),
): BalanceSummary | null {
  const version = mealsVersion.value;
  const weekAgo = addDays(today, -7);
  const since = status?.plan.startDate ?? weekAgo;
  const from = since < weekAgo ? since : weekAgo;
  const ready = profile !== null && status !== null;
  const [meals, setMeals] = useState<Meal[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    mealsInRange(from, addDays(today, -1)).then((m) => alive && setMeals(m));
    return () => {
      alive = false;
    };
  }, [ready, from, today, version]);

  if (!profile || !status || !data || !meals) return null;
  const eatenByDate = new Map<string, number>();
  for (const m of meals) eatenByDate.set(m.date, (eatenByDate.get(m.date) ?? 0) + sumItems(m.items).kcal);
  const days = [...eatenByDate.entries()].map(([date, eaten]) =>
    dayBalance(
      profile,
      weightOn(data.weights, date, status.plan.startWeight),
      date,
      eaten,
      data.activity.find((a) => a.date === date),
    ),
  );
  return summarizeBalance(days, today, since);
}
