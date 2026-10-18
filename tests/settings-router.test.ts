import { describe, expect, it } from 'vitest';
import { formatForInput, parseNumber } from '../src/components/NumberField';
import { parseHash } from '../src/lib/router';
import { DEFAULT_SETTINGS, parseSettings } from '../src/lib/settings';

describe('parseSettings', () => {
  it('uses Haiku 5.5 and 2100 kcal by default', () => {
    expect(parseSettings(null)).toEqual({ apiKey: '', model: 'claude-haiku-5-5', dailyGoal: 2100, hiddenFrequent: [] });
    expect(DEFAULT_SETTINGS.model).toBe('claude-haiku-5-5');
  });

  it('keeps valid values and drops invalid ones', () => {
    expect(parseSettings({ apiKey: ' sk-ant-x ', model: 'claude-opus-5-5', dailyGoal: 1800.4 })).toEqual({
      apiKey: 'sk-ant-x',
      model: 'claude-opus-5-5',
      dailyGoal: 1800,
      hiddenFrequent: [],
    });
    expect(parseSettings({ model: 'gpt', dailyGoal: 50 })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ hiddenFrequent: ['item:a', 3, '', 'item:a', 'meal:b|c'] }).hiddenFrequent).toEqual(['item:a', 'meal:b|c']);
  });
});

describe('parseHash', () => {
  it('maps hashes to routes', () => {
    expect(parseHash('')).toEqual({ name: 'day', date: null });
    expect(parseHash('#/day/2026-10-13')).toEqual({ name: 'day', date: '2026-10-13' });
    expect(parseHash('#/day/bad')).toEqual({ name: 'day', date: null });
    expect(parseHash('#/add')).toEqual({ name: 'add' });
    expect(parseHash('#/meal/abc%20d')).toEqual({ name: 'meal', id: 'abc d' });
    expect(parseHash('#/history')).toEqual({ name: 'history' });
    expect(parseHash('#/settings')).toEqual({ name: 'settings' });
    expect(parseHash('#/frequent')).toEqual({ name: 'frequent' });
    expect(parseHash('#/nope')).toEqual({ name: 'day', date: null });
  });
});

describe('number input', () => {
  it('parses Polish decimal commas', () => {
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber(' 150 ')).toBe(150);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('-3')).toBeNull();
  });

  it('formats values for editing', () => {
    expect(formatForInput(248.4, 0)).toBe('248');
    expect(formatForInput(2.46, 1)).toBe('2,5');
    expect(formatForInput(46, 1)).toBe('46');
  });
});
