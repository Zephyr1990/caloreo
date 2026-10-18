import { timeOf } from '../lib/dates';
import { startFromSuggestion, type PickedFood } from '../lib/draft';
import type { Suggestion } from '../lib/frequent';
import { formatGrams, formatNumber } from '../lib/nutrition';
import { hrefs, navigate } from '../lib/router';
import { useFrequent } from '../lib/useFrequent';
import { Icon } from './Icon';

/** How many suggestions the strip on the day screen shows. */
export const QUICK_ADD_LIMIT = 6;

export function itemsLabel(n: number): string {
  if (n === 1) return '1 składnik';
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} składniki`;
  return `${n} składników`;
}

/** "200 g" for a food, "posiłek · 3 składniki" for a whole meal. */
export function suggestionDetail(s: Pick<Suggestion, 'kind' | 'items'>): string {
  if (s.kind === 'meal') return `posiłek · ${itemsLabel(s.items.length)}`;
  const item = s.items[0];
  return item.portion.trim() || `${formatGrams(item.grams)} g`;
}

export function toPicked({ key, kind, title, items, kcal }: Suggestion): PickedFood {
  return { key, kind, title, items, kcal };
}

/** Opens the review step with the suggestion, so the portion can be checked before saving. */
export function openSuggestion(date: string, s: Suggestion): void {
  startFromSuggestion(date, toPicked(s));
  navigate(hrefs.add());
}

/** "Szybko dodaj": what the user usually eats at this time of day. Hidden when nothing repeats yet. */
export function QuickAdd({ date }: { date: string }) {
  const list = useFrequent({ today: date, context: { time: timeOf(new Date()) }, contextOnly: true, limit: QUICK_ADD_LIMIT });
  if (!list || list.length === 0) return null;
  return (
    <section class="stack" aria-label="Szybko dodaj" style={{ gap: '10px' }}>
      <div class="row-between" style={{ padding: '0 4px', alignItems: 'baseline' }}>
        <div class="row" style={{ gap: '8px', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Szybko dodaj</h2>
          <span class="small muted">zwykle o tej porze</span>
        </div>
        <a href={hrefs.frequent()} style={{ fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
          Wszystkie
        </a>
      </div>
      <div class="quick-strip">
        {list.map((s) => (
          <button
            key={s.key}
            type="button"
            class="quick-card"
            aria-label={`${s.title}, ${suggestionDetail(s)}, ${formatNumber(s.kcal)} kcal${s.eatenToday ? ', dziś już jest' : ''}`}
            onClick={() => openSuggestion(date, s)}
          >
            <span class="stack" style={{ gap: '2px' }}>
              <span class="quick-title">{s.title}</span>
              <span class="small muted">
                {suggestionDetail(s)}
                {s.eatenToday && ' · dziś już jest'}
              </span>
            </span>
            <span class="row-between">
              <span class="quick-kcal">
                {formatNumber(s.kcal)} <span>kcal</span>
              </span>
              <span class="quick-plus">
                <Icon name="plus" size={18} strokeWidth={2.5} />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
