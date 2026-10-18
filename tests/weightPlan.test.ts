import { describe, expect, it } from 'vitest';
import type { ActivityEntry, Profile, WeightPlan } from '../src/lib/types';
import {
  averageActivity,
  baseBurn,
  bmr,
  dayBalance,
  dayEnergy,
  daysBetween,
  declaredActivityKcal,
  evaluatePlan,
  forecastBalance,
  maxHealthyWeight,
  minHealthyWeight,
  planFit,
  planStatus,
  proposePlans,
  summarizeBalance,
  weightOn,
} from '../src/lib/weightPlan';

const ME: Profile = { sex: 'male', birthYear: 1990, heightCm: 183, activity: 'high' };
const TODAY = '2026-10-14';
const DECLARED = declaredActivityKcal(ME, 80, TODAY);

function input(targetWeight: number, targetDate: string, extra: Partial<Parameters<typeof evaluatePlan>[0]> = {}) {
  return { profile: ME, currentWeight: 80, targetWeight, targetDate, today: TODAY, activityKcal: DECLARED, ...extra };
}

describe('energy', () => {
  it('uses Mifflin-St Jeor', () => {
    expect(bmr(ME, 80, TODAY)).toBeCloseTo(1768.75);
    expect(bmr({ ...ME, sex: 'female' }, 80, TODAY)).toBeCloseTo(1602.75);
    expect(baseBurn(ME, 80, TODAY)).toBeCloseTo(2122.5);
  });

  it('derives declared activity from the level', () => {
    // 1.725 − 1.2 = 0.525 of the resting rate
    expect(DECLARED).toBeCloseTo(928.6, 1);
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-14', '2026-12-31')).toBe(78);
    expect(daysBetween('2026-10-14', '2026-11-30')).toBe(47);
    expect(daysBetween('2026-10-14', '2026-10-13')).toBe(-1);
  });

  it('knows healthy weight bounds for the height', () => {
    expect(minHealthyWeight(ME)).toBe(62);
    expect(maxHealthyWeight(ME)).toBe(100.4);
  });
});

describe('evaluatePlan', () => {
  it('accepts 80 → 72 kg by 31 Dec with high activity (board example)', () => {
    const ev = evaluatePlan(input(72, '2026-12-31'));
    expect(ev.mode).toBe('loss');
    expect(ev.days).toBe(78);
    expect(ev.dailyDelta).toBeCloseTo(789.7, 1);
    expect(ev.dailyTarget).toBe(2260);
    expect(ev.weeklyKg).toBeCloseTo(0.718, 3);
    expect(ev.issues).toEqual([]);
  });

  it('flags a too fast plan: 72 kg by 30 Nov', () => {
    const ev = evaluatePlan(input(72, '2026-11-30'));
    expect(ev.dailyDelta).toBeCloseTo(1310.6, 1);
    expect(ev.issues.map((i) => i.code)).toEqual(['pace_too_fast', 'deficit_too_big']);
    expect(ev.issues.every((i) => !i.blocking)).toBe(true);
  });

  it('flags too little food for a sedentary profile', () => {
    const sedentary = { ...ME, activity: 'sedentary' as const };
    const ev = evaluatePlan(input(72, '2026-12-31', { profile: sedentary, activityKcal: 0 }));
    expect(ev.dailyTarget).toBe(1330);
    expect(ev.issues.map((i) => i.code)).toEqual(['intake_too_low']);
  });

  it('blocks a target below BMI 18.5 and a date too soon', () => {
    expect(evaluatePlan(input(60, '2027-06-01')).issues.map((i) => [i.code, i.blocking])).toEqual([['target_too_low', true]]);
    expect(evaluatePlan(input(79, '2026-10-18')).issues.map((i) => i.code)).toContain('date_too_soon');
  });

  it('handles maintenance and weight gain', () => {
    const keep = evaluatePlan(input(80, '2026-12-31'));
    expect(keep.mode).toBe('maintain');
    expect(keep.dailyTarget).toBe(3050);
    expect(keep.issues).toEqual([]);

    const gain = evaluatePlan(input(83, '2027-01-31'));
    expect(gain.mode).toBe('gain');
    expect(gain.dailyDelta).toBeLessThan(0);
    expect(gain.dailyTarget).toBeGreaterThan(3050);
    expect(gain.issues).toEqual([]);

    const fastGain = evaluatePlan(input(86, '2026-11-30'));
    expect(fastGain.issues.map((i) => i.code)).toEqual(['pace_too_fast', 'surplus_too_big']);
    expect(evaluatePlan(input(101, '2028-01-01')).issues.map((i) => i.code)).toContain('target_too_high');
  });
});

describe('proposePlans', () => {
  it('proposes a later date and a smaller loss within the limits (board example)', () => {
    const [later, smaller] = proposePlans(input(72, '2026-11-30'));
    expect(later.id).toBe('later');
    expect(later.targetDate).toBe('2026-12-23');
    expect(later.evaluation.dailyTarget).toBe(2170);
    expect(later.evaluation.issues).toEqual([]);

    expect(smaller.id).toBe('smaller');
    expect(smaller.targetDate).toBe('2026-11-30');
    expect(smaller.targetWeight).toBe(74.7);
    expect(smaller.evaluation.dailyTarget).toBe(2180);
    expect(smaller.evaluation.issues).toEqual([]);
  });

  it('proposes the lowest healthy weight for a too low target', () => {
    const [p] = proposePlans(input(55, '2027-12-31'));
    expect(p.id).toBe('healthy');
    expect(p.targetWeight).toBe(62);
  });

  it('proposes slower gain', () => {
    const proposals = proposePlans(input(86, '2026-11-30'));
    expect(proposals.map((p) => p.id)).toEqual(['later', 'smaller']);
    for (const p of proposals) expect(p.evaluation.issues).toEqual([]);
  });

  it('proposes nothing for a sensible plan', () => {
    expect(proposePlans(input(72, '2026-12-31'))).toEqual([]);
  });
});

describe('averageActivity', () => {
  const entry = (date: string, activeKcal: number | null): ActivityEntry => ({ date, activeKcal, steps: null, updatedAt: '' });

  it('uses the declared level until there are 7 days of Garmin data', () => {
    const few = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'].map((d) => entry(d, 700));
    expect(averageActivity(few, ME, 80, TODAY)).toMatchObject({ source: 'declared', count: 4 });
  });

  it('averages the last 14 full days, skipping today and empty entries', () => {
    // 4-13 Oct, with no calories entered on the 9th (i = 5).
    const days = Array.from({ length: 10 }, (_, i) =>
      entry(`2026-10-${String(4 + i).padStart(2, '0')}`, i === 5 ? null : 600 + i * 10),
    );
    const all = [...days, entry('2026-10-14', 5000), entry('2026-09-01', 9999)];
    const avg = averageActivity(all, ME, 80, TODAY);
    expect(avg.source).toBe('garmin');
    expect(avg.count).toBe(9);
    expect(avg.kcal).toBeCloseTo((600 + 610 + 620 + 630 + 640 + 660 + 670 + 680 + 690) / 9);
  });
});

describe('planStatus', () => {
  const plan: WeightPlan = {
    startDate: '2026-10-14',
    startWeight: 80,
    targetWeight: 72,
    targetDate: '2026-12-23',
    acceptedUnsafe: false,
    createdAt: '',
  };
  const garmin = (from: string, n: number, kcal: number): ActivityEntry[] =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(2026, 9, 14 + i);
      const key = `2026-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date: key, activeKcal: kcal, steps: 11000, updatedAt: from };
    });

  it('recalculates from the latest weigh-in and Garmin average (board example)', () => {
    const s = planStatus({
      profile: ME,
      plan,
      weights: [
        { date: '2026-10-14', kg: 80, updatedAt: '' },
        { date: '2026-10-28', kg: 78.4, updatedAt: '' },
      ],
      activity: garmin('', 14, 700),
      today: '2026-10-28',
    });
    expect(s.state).toBe('active');
    expect(s.currentWeight).toBe(78.4);
    expect(s.activity).toMatchObject({ source: 'garmin', kcal: 700 });
    expect(s.daysLeft).toBe(56);
    expect(s.dailyDelta).toBeCloseTo(880, 0);
    expect(s.dailyTarget).toBe(1920);
    expect(s.offTrackKg).toBeCloseTo(0, 1);
    expect(s.doneKg).toBeCloseTo(1.6);
    expect(s.clamped).toBe(false);
  });

  it('keeps the daily target within limits when falling behind, and suggests a later date', () => {
    const s = planStatus({
      profile: ME,
      plan,
      weights: [{ date: '2026-12-09', kg: 78 }].map((w) => ({ ...w, updatedAt: '' })),
      activity: [],
      today: '2026-12-09',
    });
    expect(s.evaluation.issues.length).toBeGreaterThan(0);
    expect(s.clamped).toBe(true);
    expect(s.dailyDelta).toBeLessThanOrEqual(880 + 1e-6);
    expect(s.suggestion?.targetDate && s.suggestion.targetDate > plan.targetDate).toBe(true);
  });

  it('does not clamp a plan the user accepted despite warnings', () => {
    const s = planStatus({
      profile: ME,
      plan: { ...plan, acceptedUnsafe: true },
      weights: [{ date: '2026-12-09', kg: 78, updatedAt: '' }],
      activity: [],
      today: '2026-12-09',
    });
    expect(s.clamped).toBe(false);
    expect(s.dailyDelta).toBeGreaterThan(1000);
  });

  it('switches to maintenance when the target is reached or the date passed', () => {
    const reached = planStatus({ profile: ME, plan, weights: [{ date: '2026-12-01', kg: 71.9, updatedAt: '' }], activity: [], today: '2026-12-01' });
    expect(reached.state).toBe('reached');
    expect(reached.dailyDelta).toBe(0);
    const expired = planStatus({ profile: ME, plan, weights: [{ date: '2026-12-20', kg: 75, updatedAt: '' }], activity: [], today: '2026-12-24' });
    expect(expired.state).toBe('expired');
  });
});

describe('balance', () => {
  it('computes the day balance from base, Garmin active calories and food', () => {
    const b = dayBalance(ME, 78.4, '2026-10-28', 1860, { date: '2026-10-28', activeKcal: 960, steps: 11200, updatedAt: '' });
    expect(Math.round(b.base)).toBe(2103);
    expect(Math.round(b.burned as number)).toBe(3063);
    expect(Math.round(b.balance as number)).toBe(1203);
    expect(dayBalance(ME, 78.4, '2026-10-28', 1860, undefined).balance).toBeNull();
  });

  it('summarizes the last 7 days and the total since the start', () => {
    const days = [
      { date: '2026-10-20', balance: 800 },
      { date: '2026-10-25', balance: 1000 },
      { date: '2026-10-27', balance: 900 },
      { date: '2026-10-28', balance: 5000 },
      { date: '2026-10-26', balance: null },
    ].map((d) => ({ ...d, eaten: 2000, base: 2100, activeKcal: 0, burned: 0 }));
    const s = summarizeBalance(days, '2026-10-28', '2026-10-14');
    expect(s.count7).toBe(2);
    expect(s.avg7).toBe(950);
    expect(s.sum).toBe(2700);
    expect(s.countSum).toBe(3);
    expect(s.kgEstimate).toBeCloseTo(2700 / 7700);
  });

  it('finds the weight valid on a day', () => {
    const w = [
      { date: '2026-10-14', kg: 80, updatedAt: '' },
      { date: '2026-10-21', kg: 79.2, updatedAt: '' },
    ];
    expect(weightOn(w, '2026-10-13', 81)).toBe(81);
    expect(weightOn(w, '2026-10-20', 81)).toBe(80);
    expect(weightOn(w, '2026-10-25', 81)).toBe(79.2);
  });
});

describe('dayEnergy', () => {
  const entry = (date: string, activeKcal: number | null): ActivityEntry => ({ date, activeKcal, steps: null, updatedAt: '' });
  const BASE = 1768.75 * 1.2;

  it('uses the Garmin calories entered for the day', () => {
    const e = dayEnergy(ME, 80, TODAY, 1860, [entry(TODAY, 940), entry('2026-10-13', 500)]);
    expect(e.activitySource).toBe('entered');
    expect(e.burned).toBeCloseTo(BASE + 940);
    expect(e.balance).toBeCloseTo(BASE + 940 - 1860);
  });

  it('estimates from the average of the last 7 days before the entry', () => {
    // 7-13 Oct are the 7 days before; 6 Oct and a later day do not count.
    const activity = [
      entry('2026-10-06', 2000),
      entry('2026-10-08', 600),
      entry('2026-10-10', 700),
      entry('2026-10-12', null),
      entry('2026-10-13', 740),
      entry('2026-10-15', 3000),
    ];
    const e = dayEnergy(ME, 80, TODAY, 540, activity);
    expect(e.activitySource).toBe('average');
    expect(e.activityDays).toBe(3);
    expect(e.activeKcal).toBeCloseTo(680);
    expect(e.balance).toBeCloseTo(BASE + 680 - 540);
  });

  it('falls back to the declared level with fewer than 3 days in the last week', () => {
    const e = dayEnergy(ME, 80, TODAY, 540, [entry('2026-10-12', 700), entry('2026-10-13', 700)]);
    expect(e.activitySource).toBe('declared');
    expect(e.activityDays).toBe(2);
    expect(e.activeKcal).toBeCloseTo(DECLARED);
  });

  it('forecasts the balance if the rest of the goal is eaten', () => {
    const e = dayEnergy(ME, 80, TODAY, 540, [entry('2026-10-11', 680), entry('2026-10-12', 680), entry('2026-10-13', 680)]);
    expect(forecastBalance(e, 1920)).toBeCloseTo(BASE + 680 - 1920);
    // Over the goal already: nothing more is assumed.
    const over = { ...e, eaten: 2500 };
    expect(forecastBalance(over, 1920)).toBeCloseTo(BASE + 680 - 2500);
  });
});

describe('planFit', () => {
  it('compares a deficit with a deficit plan', () => {
    expect(planFit(1200, 880)).toBe('more');
    expect(planFit(900, 880)).toBe('on');
    expect(planFit(840, 880)).toBe('on');
    expect(planFit(500, 880)).toBe('less');
    expect(planFit(-200, 880)).toBe('opposite');
  });

  it('compares a surplus with a gain plan', () => {
    expect(planFit(-500, -300)).toBe('more');
    expect(planFit(-320, -300)).toBe('on');
    expect(planFit(-100, -300)).toBe('less');
    expect(planFit(200, -300)).toBe('opposite');
  });

  it('has nothing to compare without a deficit or surplus in the plan', () => {
    expect(planFit(500, 0)).toBeNull();
  });
});
