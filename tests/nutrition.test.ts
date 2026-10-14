import { describe, expect, it } from 'vitest';
import {
  energyShares,
  formatGrams,
  formatNumber,
  goalProgress,
  mealTypeForTime,
  scaleItem,
  sumItems,
} from '../src/lib/nutrition';
import type { FoodItem } from '../src/lib/types';

const chicken: FoodItem = {
  id: 'a',
  name: 'Pierś z kurczaka',
  portion: '150 g',
  grams: 150,
  kcal: 248,
  protein: 46,
  fat: 5,
  carbs: 0,
};

describe('sumItems', () => {
  it('adds kcal and macros', () => {
    const t = sumItems([chicken, { ...chicken, kcal: 345, protein: 7, fat: 1, carbs: 78 }]);
    expect(t).toEqual({ kcal: 593, protein: 53, fat: 6, carbs: 78 });
  });

  it('treats non-finite values as zero', () => {
    expect(sumItems([{ kcal: NaN, protein: Infinity, fat: 1, carbs: 2 }])).toEqual({ kcal: 0, protein: 0, fat: 1, carbs: 2 });
  });
});

describe('scaleItem', () => {
  it('scales kcal and macros proportionally to grams', () => {
    const s = scaleItem(chicken, 75);
    expect(s.grams).toBe(75);
    expect(s.kcal).toBeCloseTo(124);
    expect(s.protein).toBeCloseTo(23);
    expect(s.fat).toBeCloseTo(2.5);
  });

  it('only sets grams when the base weight is unknown', () => {
    const s = scaleItem({ ...chicken, grams: 0 }, 100);
    expect(s.grams).toBe(100);
    expect(s.kcal).toBe(248);
  });

  it('scaling down to zero and back from the same base restores the values', () => {
    expect(scaleItem(chicken, 0).kcal).toBe(0);
    expect(scaleItem(chicken, 150).kcal).toBe(248);
  });
});

describe('energyShares', () => {
  it('returns whole percents that add up to 100', () => {
    const s = energyShares({ kcal: 0, protein: 88, fat: 47, carbs: 137 });
    expect(s.protein + s.fat + s.carbs).toBe(100);
    expect(s).toEqual({ protein: 27, fat: 32, carbs: 41 });
  });

  it('returns zeros when there is no energy', () => {
    expect(energyShares({ kcal: 0, protein: 0, fat: 0, carbs: 0 })).toEqual({ protein: 0, fat: 0, carbs: 0 });
  });
});

describe('goalProgress', () => {
  it('reports remaining calories under the goal', () => {
    expect(goalProgress(1340, 2100)).toEqual({ remaining: 760, over: 0, percent: 64 });
  });

  it('reports calories over the goal', () => {
    expect(goalProgress(2310, 2100)).toEqual({ remaining: 0, over: 210, percent: 110 });
  });
});

describe('mealTypeForTime', () => {
  it.each([
    [7, 45, 'breakfast'],
    [11, 0, 'second_breakfast'],
    [13, 40, 'lunch'],
    [16, 10, 'afternoon_snack'],
    [19, 0, 'dinner'],
    [22, 30, 'snack'],
    [2, 0, 'snack'],
  ] as const)('%i:%i -> %s', (h, m, expected) => {
    expect(mealTypeForTime(h, m)).toBe(expected);
  });
});

describe('formatting', () => {
  it('groups thousands with a non-breaking space', () => {
    expect(formatNumber(1340.4)).toBe('1 340');
    expect(formatNumber(980)).toBe('980');
    expect(formatNumber(12345)).toBe('12 345');
  });

  it('shows one decimal for small gram values', () => {
    expect(formatGrams(2.46)).toBe('2,5');
    expect(formatGrams(46.4)).toBe('46');
    expect(formatGrams(0)).toBe('0');
  });
});
