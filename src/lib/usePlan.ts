import { useEffect, useState } from 'preact/hooks';
import { body, type BodySettings } from './body';
import { todayKey } from './dates';
import { allActivity, allWeights, bodyVersion } from './db';
import { settings } from './settings';
import type { ActivityEntry, WeightEntry } from './types';
import { planStatus, type PlanStatus } from './weightPlan';

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
