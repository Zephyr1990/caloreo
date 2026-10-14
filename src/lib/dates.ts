/** Dates are stored as local calendar days ("YYYY-MM-DD") so a meal stays on the day it was eaten. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

export function isDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toDateKey(parseDateKey(s)) === s;
}

/** Local midnight of the given day. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Inclusive list of `count` days ending at `endKey`, oldest first. */
export function lastDays(endKey: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(endKey, -i));
  return out;
}

export function timeOf(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const WEEKDAYS_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
const MONTHS_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

/** "wtorek, 14 października" */
export function longDate(key: string): string {
  const d = parseDateKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

/** "14.10" */
export function shortDate(key: string): string {
  const d = parseDateKey(key);
  return `${d.getDate()}.${pad(d.getMonth() + 1)}`;
}

/** "Wt" */
export function weekdayShort(key: string): string {
  return WEEKDAYS_SHORT[parseDateKey(key).getDay()];
}

/** "Wtorek" */
export function weekdayLong(key: string): string {
  const w = WEEKDAYS[parseDateKey(key).getDay()];
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** "Dziś", "Wczoraj" or the weekday name. */
export function dayTitle(key: string, today: string = todayKey()): string {
  if (key === today) return 'Dziś';
  if (key === addDays(today, -1)) return 'Wczoraj';
  return weekdayLong(key);
}
