import { describe, expect, it } from 'vitest';
import { addDays } from '../src/lib/dates';
import { frequentNames, frequentSuggestions, normalizeName, suggestionItems } from '../src/lib/frequent';
import type { FoodItem, Meal, MealType } from '../src/lib/types';

const TODAY = '2026-10-18';

function item(name: string, kcal: number, portion = ''): FoodItem {
  return { id: `${name}-${kcal}`, name, portion, grams: 100, kcal, protein: 1, fat: 1, carbs: 1 };
}

let n = 0;
function meal(daysAgo: number, time: string, items: FoodItem[], extra: Partial<Meal> = {}): Meal {
  n++;
  return {
    id: `m${n}`,
    name: '',
    type: 'breakfast' as MealType,
    date: addDays(TODAY, -daysAgo),
    time,
    description: '',
    items,
    notes: '',
    confidence: null,
    source: 'ai',
    model: null,
    thumbnail: null,
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

const at = (time: string) => ({ today: TODAY, context: { time } });

describe('normalizeName', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(normalizeName('  Serek  wiejski.')).toBe('serek wiejski');
    expect(normalizeName('Kawa „czarna”')).toBe('kawa czarna');
    expect(normalizeName('ŻUREK')).toBe('żurek');
  });
});

describe('frequentSuggestions', () => {
  it('needs 3 occurrences in the last 60 days', () => {
    const meals = [
      meal(1, '08:00', [item('Cappuccino', 110)]),
      meal(2, '08:00', [item('cappuccino', 110)]),
      meal(60, '08:00', [item('Cappuccino', 110)]),
      meal(3, '08:00', [item('Banan', 105)]),
      meal(4, '08:00', [item('Banan', 105)]),
    ];
    expect(frequentSuggestions(meals, at('08:00'))).toEqual([]);
    const s = frequentSuggestions([...meals, meal(10, '08:00', [item('Cappuccino.', 110)])], at('08:00'));
    expect(s.map((x) => x.key)).toEqual(['item:cappuccino']);
    expect(s[0].count).toBe(3);
  });

  it('counts a food inside bigger meals and takes the portion from the last time', () => {
    const meals = [
      meal(5, '07:30', [item('Serek wiejski', 190, '200 g'), item('Chleb', 140)]),
      meal(3, '07:40', [item('Serek wiejski', 95, '100 g')]),
      meal(1, '07:45', [item('Serek wiejski', 140, '150 g'), item('Pomidor', 20)]),
    ];
    const [s] = frequentSuggestions(meals, at('07:30'));
    expect(s.key).toBe('item:serek wiejski');
    expect(s.items).toHaveLength(1);
    expect(s.items[0].portion).toBe('150 g');
    expect(s.kcal).toBe(140);
    expect(s.usualTime).toBe('7:45');
  });

  it('suggests whole meals when the same set of foods repeats', () => {
    const oats = () => [item('Owsianka', 300), item('Banan', 105), item('Kawa', 5)];
    const meals = [1, 2, 3].map((d) => meal(d, '07:30', oats(), { name: 'Owsianka z bananem' }));
    const s = frequentSuggestions(meals, at('07:30'));
    const whole = s.find((x) => x.kind === 'meal');
    expect(whole?.title).toBe('Owsianka z bananem');
    expect(whole?.items).toHaveLength(3);
    expect(whole?.kcal).toBe(410);
    expect(s.filter((x) => x.kind === 'item')).toHaveLength(3);
  });

  it('ranks foods eaten at this time of day higher', () => {
    const meals = [
      ...[1, 2, 3].map((d) => meal(d, '08:00', [item('Cappuccino', 110)])),
      ...[1, 2, 3, 4].map((d) => meal(d, '19:00', [item('Twarożek', 200)])),
    ];
    expect(frequentSuggestions(meals, at('08:15'))[0].title).toBe('Cappuccino');
    expect(frequentSuggestions(meals, at('19:30'))[0].title).toBe('Twarożek');
    // Without a time of day the more frequent one wins.
    expect(frequentSuggestions(meals, { today: TODAY, context: null })[0].title).toBe('Twarożek');
  });

  it('puts foods eaten at this time first and can keep only those', () => {
    const meals = [
      ...[1, 2, 3, 4, 5, 6].map((d) => meal(d, '13:30', [item('Kurczak', 600)], { type: 'lunch' })),
      ...[1, 2, 3].map((d) => meal(d, '08:00', [item('Serek', 190)])),
    ];
    expect(frequentSuggestions(meals, at('08:30')).map((s) => s.title)).toEqual(['Serek', 'Kurczak']);
    expect(frequentSuggestions(meals, { ...at('08:30'), contextOnly: true }).map((s) => s.title)).toEqual(['Serek']);
    expect(frequentSuggestions(meals, { today: TODAY, context: { type: 'lunch' }, contextOnly: true }).map((s) => s.title)).toEqual([
      'Kurczak',
    ]);
  });

  it('wraps around midnight when comparing times', () => {
    const meals = [
      ...[1, 2, 3].map((d) => meal(d, '23:50', [item('Herbata', 0)])),
      ...[1, 2, 3].map((d) => meal(d, '12:00', [item('Zupa', 200)])),
    ];
    expect(frequentSuggestions(meals, at('00:30'))[0].title).toBe('Herbata');
  });

  it('can rank by meal type instead of the time', () => {
    const meals = [
      ...[1, 2, 3].map((d) => meal(d, '08:00', [item('Cappuccino', 110)], { type: 'breakfast' })),
      ...[1, 2, 3, 4].map((d) => meal(d, '19:00', [item('Twarożek', 200)], { type: 'dinner' })),
    ];
    expect(frequentSuggestions(meals, { today: TODAY, context: { type: 'breakfast' } })[0].title).toBe('Cappuccino');
  });

  it('weights recent days more', () => {
    const meals = [
      ...[1, 2, 3].map((d) => meal(d, '12:00', [item('Nowe', 100)])),
      ...[40, 41, 42, 43].map((d) => meal(d, '12:00', [item('Stare', 100)])),
    ];
    expect(frequentSuggestions(meals, at('12:00'))[0].title).toBe('Nowe');
  });

  it('moves what was already eaten today to the end', () => {
    const meals = [
      ...[0, 1, 2, 3].map((d) => meal(d, '08:00', [item('Cappuccino', 110)])),
      ...[1, 2, 3].map((d) => meal(d, '08:00', [item('Banan', 105)])),
    ];
    const s = frequentSuggestions(meals, at('08:00'));
    expect(s.map((x) => x.title)).toEqual(['Banan', 'Cappuccino']);
    expect(s[1].eatenToday).toBe(true);
  });

  it('skips hidden suggestions unless asked to keep them', () => {
    const meals = [1, 2, 3].map((d) => meal(d, '08:00', [item('Cappuccino', 110)]));
    expect(frequentSuggestions(meals, { ...at('08:00'), hidden: ['item:cappuccino'] })).toEqual([]);
    expect(frequentSuggestions(meals, { ...at('08:00'), hidden: ['item:cappuccino'], includeHidden: true })).toHaveLength(1);
  });

  it('limits the list and ignores meals after the day', () => {
    const meals = ['A', 'B', 'C', 'D'].flatMap((name) => [1, 2, 3].map((d) => meal(d, '08:00', [item(name, 100)])));
    expect(frequentSuggestions(meals, { ...at('08:00'), limit: 2 })).toHaveLength(2);
    const future = [-1, -2, -3].map((d) => meal(d, '08:00', [item('Jutro', 100)]));
    expect(frequentSuggestions(future, at('08:00'))).toEqual([]);
  });

  it('gives fresh item ids for a new meal', () => {
    const meals = [1, 2, 3].map((d) => meal(d, '08:00', [item('Cappuccino', 110)]));
    const [s] = frequentSuggestions(meals, at('08:00'));
    const copy = suggestionItems(s);
    expect(copy[0].id).not.toBe(s.items[0].id);
    expect(copy[0].name).toBe('Cappuccino');
  });
});

describe('frequentNames', () => {
  it('lists names used at least twice, most frequent first, with the latest spelling', () => {
    const meals = [
      meal(5, '08:00', [item('serek wiejski', 190)]),
      meal(3, '08:00', [item('Serek wiejski', 190), item('Cappuccino', 110)]),
      meal(2, '08:00', [item('Serek Wiejski', 190), item('Cappuccino', 110)]),
      meal(1, '08:00', [item('Banan', 105)]),
    ];
    expect(frequentNames(meals, TODAY)).toEqual(['Serek Wiejski', 'Cappuccino']);
    expect(frequentNames(meals, TODAY, 1)).toEqual(['Serek Wiejski']);
  });
});
