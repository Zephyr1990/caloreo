import { describe, expect, it } from 'vitest';
import { chartMax, summarizeHistory } from '../src/lib/history';
import type { Meal } from '../src/lib/types';

function meal(date: string, kcal: number): Meal {
  return {
    id: `${date}-${kcal}`,
    name: 'x',
    type: 'lunch',
    date,
    time: '12:00',
    description: '',
    items: [{ id: 'i', name: 'x', portion: '', grams: 100, kcal, protein: 0, fat: 0, carbs: 0 }],
    notes: '',
    confidence: null,
    source: 'manual',
    model: null,
    thumbnail: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('summarizeHistory', () => {
  const meals = [
    meal('2026-10-08', 1860),
    meal('2026-10-09', 1000),
    meal('2026-10-09', 780),
    meal('2026-10-10', 2240),
    meal('2026-10-13', 1950),
    meal('2026-10-14', 1340),
  ];

  it('totals each day of the range, oldest first', () => {
    const s = summarizeHistory(meals, '2026-10-14', 7, 2100);
    expect(s.days.map((d) => d.date)).toEqual([
      '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14',
    ]);
    expect(s.days.map((d) => d.kcal)).toEqual([1860, 1780, 2240, 0, 0, 1950, 1340]);
    expect(s.days[6].isToday).toBe(true);
    expect(s.max).toBe(2240);
  });

  it('averages finished days with entries and counts days within the goal', () => {
    const s = summarizeHistory(meals, '2026-10-14', 7, 2100);
    expect(s.countedDays).toBe(4);
    expect(s.average).toBe(Math.round((1860 + 1780 + 2240 + 1950) / 4));
    expect(s.daysWithinGoal).toBe(3);
  });

  it('has no average when only today has entries', () => {
    const s = summarizeHistory([meal('2026-10-14', 500)], '2026-10-14', 7, 2100);
    expect(s.average).toBeNull();
    expect(s.countedDays).toBe(0);
  });
});

describe('chartMax', () => {
  it('leaves headroom above the goal or the highest day', () => {
    expect(chartMax(2240, 2100)).toBe(2500);
    expect(chartMax(0, 2100)).toBe(2400);
  });
});
