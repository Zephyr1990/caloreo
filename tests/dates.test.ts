import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayTitle,
  isDateKey,
  isTime,
  lastDays,
  longDate,
  shortDate,
  toDateKey,
  weekdayShort,
} from '../src/lib/dates';

describe('dates', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
    expect(toDateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('lists the last N days oldest first', () => {
    expect(lastDays('2026-10-14', 3)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
  });

  it('validates date keys and times', () => {
    expect(isDateKey('2026-10-14')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('14.10.2026')).toBe(false);
    expect(isTime('07:45')).toBe(true);
    expect(isTime('24:00')).toBe(false);
  });

  it('formats Polish labels', () => {
    expect(longDate('2026-10-14')).toBe('środa, 14 października');
    expect(longDate('2026-10-13')).toBe('wtorek, 13 października');
    expect(shortDate('2026-10-08')).toBe('8.10');
    expect(weekdayShort('2026-10-08')).toBe('Cz');
  });

  it('names today and yesterday', () => {
    expect(dayTitle('2026-10-14', '2026-10-14')).toBe('Dziś');
    expect(dayTitle('2026-10-13', '2026-10-14')).toBe('Wczoraj');
    expect(dayTitle('2026-10-11', '2026-10-14')).toBe('Niedziela');
  });
});
