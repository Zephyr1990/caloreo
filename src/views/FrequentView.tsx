import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { openSuggestion, suggestionDetail } from '../components/QuickAdd';
import { timeOf, todayKey } from '../lib/dates';
import { FREQUENT_MIN_COUNT, FREQUENT_WINDOW_DAYS, type Suggestion } from '../lib/frequent';
import { formatNumber } from '../lib/nutrition';
import { hrefs, navigate } from '../lib/router';
import { hideSuggestion, settings, unhideSuggestion } from '../lib/settings';
import { useFrequent } from '../lib/useFrequent';

type Scope = 'now' | 'all';

export function FrequentView() {
  const today = todayKey();
  const [scope, setScope] = useState<Scope>('now');
  const [showHidden, setShowHidden] = useState(false);
  const list = useFrequent({ today, context: scope === 'now' ? { time: timeOf(new Date()) } : null, includeHidden: true });
  const hiddenKeys = new Set(settings.value.hiddenFrequent);
  const ranked = scope === 'all' && list ? [...list].sort((a, b) => b.count - a.count || b.score - a.score) : (list ?? []);
  const visible = ranked.filter((s) => !hiddenKeys.has(s.key));
  const hidden = ranked.filter((s) => hiddenKeys.has(s.key));
  const meals = visible.filter((s) => s.kind === 'meal');
  const items = visible.filter((s) => s.kind === 'item');
  const back = () => (history.length > 1 ? history.back() : navigate(hrefs.today()));

  return (
    <main class="screen">
      <header class="topbar">
        <button type="button" class="round-btn" aria-label="Wróć" onClick={back}>
          <Icon name="chevronLeft" />
        </button>
        <h1>Wszystkie częste</h1>
        <span class="spacer-44" />
      </header>

      <div class="segmented" role="group" aria-label="Kolejność" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <button type="button" aria-pressed={scope === 'now'} onClick={() => setScope('now')}>
          O tej porze
        </button>
        <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
          Wszystkie
        </button>
      </div>

      {list && visible.length === 0 && (
        <div class="empty">
          Jeszcze nic się nie powtarza. Podpowiedź pojawi się, gdy coś zjesz co najmniej {FREQUENT_MIN_COUNT} razy w ciągu{' '}
          {FREQUENT_WINDOW_DAYS} dni.
        </div>
      )}

      {meals.length > 0 && <Section title="Całe posiłki" list={meals} today={today} />}
      {items.length > 0 && <Section title="Produkty" list={items} today={today} />}

      {list && (
        <div class="small muted" style={{ padding: '0 4px', lineHeight: 1.45 }}>
          Liczby z ostatnich {FREQUENT_WINDOW_DAYS} dni.{' '}
          {scope === 'now' ? 'Pora dnia porządkuje listę: rano wyżej są rzeczy jedzone zwykle rano.' : 'Najczęstsze na górze.'}
        </div>
      )}

      {hidden.length > 0 && (
        <button type="button" class="btn btn-dashed" aria-expanded={showHidden} onClick={() => setShowHidden(!showHidden)}>
          Ukryte: {hidden.length} · {showHidden ? 'Schowaj' : 'Pokaż'}
        </button>
      )}
      {showHidden && hidden.length > 0 && <Section title="Ukryte" list={hidden} today={today} hidden />}
    </main>
  );
}

function Section({ title, list, today, hidden = false }: { title: string; list: Suggestion[]; today: string; hidden?: boolean }) {
  return (
    <section class="stack" aria-label={title}>
      <h2 class="section-label">{title}</h2>
      <div class="list-card">
        {list.map((s) => (
          <div key={s.key} class="frequent-row">
            <span class="stack" style={{ gap: '2px', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '15px', fontWeight: 700 }}>{s.title}</span>
              <span class="small" style={{ color: 'var(--ink-secondary)' }}>
                {suggestionDetail(s)} · {formatNumber(s.kcal)} kcal · {s.count} razy · ok. {s.usualTime}
              </span>
            </span>
            {hidden ? (
              <button type="button" class="btn btn-outline btn-small" aria-label={`Przywróć: ${s.title}`} onClick={() => unhideSuggestion(s.key)}>
                <Icon name="eye" size={18} />
                Przywróć
              </button>
            ) : (
              <>
                <button type="button" class="btn btn-outline btn-small" aria-label={`Dodaj: ${s.title}`} onClick={() => openSuggestion(today, s)}>
                  Dodaj
                </button>
                <button type="button" class="icon-btn" aria-label={`Ukryj: ${s.title}`} onClick={() => hideSuggestion(s.key)}>
                  <Icon name="eyeOff" size={20} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
