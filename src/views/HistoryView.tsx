import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { addDays, shortDate, todayKey, weekdayLong, weekdayShort } from '../lib/dates';
import { mealsInRange, mealsVersion } from '../lib/db';
import { chartMax, summarizeHistory, type DayStat } from '../lib/history';
import { formatNumber } from '../lib/nutrition';
import { hrefs } from '../lib/router';
import { settings } from '../lib/settings';
import type { Meal } from '../lib/types';

/** Kept outside the view so the choice survives switching tabs. */
const range = signal<7 | 30>(7);

const PLOT_HEIGHT = 160;

export function HistoryView() {
  const today = todayKey();
  const count = range.value;
  const goal = settings.value.dailyGoal;
  const version = mealsVersion.value;
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    mealsInRange(addDays(today, -(count - 1)), today).then((m) => alive && setMeals(m));
    return () => {
      alive = false;
    };
  }, [today, count, version]);

  const summary = summarizeHistory(meals ?? [], today, count, goal);
  const top = chartMax(summary.max, goal);
  const selectedDay = summary.days.find((d) => d.date === selected) ?? null;
  const listed = [...summary.days].reverse().filter((d) => d.meals > 0 || d.isToday);

  return (
    <>
      <main class="screen with-tabbar">
        <header class="row-between" style={{ minHeight: '44px' }}>
          <h1 class="page-title">Historia</h1>
          <div class="segmented" role="group" aria-label="Zakres">
            {([7, 30] as const).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={count === n}
                onClick={() => {
                  range.value = n;
                  setSelected(null);
                }}
              >
                {n} dni
              </button>
            ))}
          </div>
        </header>

        <div class="grid-2">
          <div class="card" style={{ padding: '14px', gap: '2px' }}>
            <div class="label" style={{ fontSize: '13px' }}>
              Średnio
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700 }}>
              {summary.average === null ? '–' : formatNumber(summary.average)}
            </div>
            <div class="small muted">
              {summary.countedDays
                ? `kcal dziennie (${daysLabel(summary.countedDays)} z wpisami)`
                : 'brak pełnych dni z wpisami'}
            </div>
          </div>
          <div class="card" style={{ padding: '14px', gap: '2px' }}>
            <div class="label" style={{ fontSize: '13px' }}>
              W granicach celu
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700 }}>
              {summary.countedDays ? `${summary.daysWithinGoal} z ${summary.countedDays}` : '–'}
            </div>
            <div class="small muted">dni do {formatNumber(goal)} kcal</div>
          </div>
        </div>

        <figure class="card chart" style={{ margin: 0 }}>
          <figcaption style={{ fontSize: '15px', fontWeight: 700 }}>Kalorie dziennie, ostatnie {count} dni</figcaption>
          <div class="chart-readout" aria-live="polite">
            {selectedDay ? (
              <>
                <span>
                  {weekdayLong(selectedDay.date)}, {shortDate(selectedDay.date)}:{' '}
                  <strong>{formatNumber(selectedDay.kcal)} kcal</strong>
                </span>
                {selectedDay.meals > 0 && (
                  <a href={selectedDay.isToday ? hrefs.today() : hrefs.day(selectedDay.date)}>Otwórz dzień</a>
                )}
              </>
            ) : (
              <span class="muted">Dotknij słupka, aby zobaczyć szczegóły.</span>
            )}
          </div>
          <div class="chart-plot" style={{ height: `${PLOT_HEIGHT}px` }}>
            <div class="chart-goal" style={{ bottom: `${(goal / top) * PLOT_HEIGHT}px` }} />
            <div class="chart-goal-label" style={{ bottom: `${(goal / top) * PLOT_HEIGHT + 4}px` }}>
              Cel {formatNumber(goal)}
            </div>
            <div class="chart-cols" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
              {summary.days.map((d) => (
                <Bar
                  key={d.date}
                  day={d}
                  height={(d.kcal / top) * PLOT_HEIGHT}
                  selected={d.date === selected}
                  showValue={count === 7 && d.isToday && d.kcal > 0}
                  onSelect={() => setSelected(d.date === selected ? null : d.date)}
                />
              ))}
            </div>
          </div>
          <div class="chart-x" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }} aria-hidden="true">
            {summary.days.map((d, i) => (
              <div key={d.date} class={d.isToday ? 'today' : undefined}>
                {count === 7 ? (
                  <>
                    {weekdayShort(d.date)}
                    <br />
                    {d.isToday ? 'dziś' : shortDate(d.date)}
                  </>
                ) : (count - 1 - i) % 7 === 0 ? (
                  d.isToday ? 'dziś' : shortDate(d.date)
                ) : (
                  ''
                )}
              </div>
            ))}
          </div>
          <div class="small muted">Jaśniejszy słupek: dzień w trakcie.</div>
        </figure>

        <section class="stack" aria-label="Dni">
          {listed.map((d) => (
            <DayRow key={d.date} day={d} goal={goal} />
          ))}
          {listed.length === 1 && listed[0].meals === 0 && (
            <div class="empty">Brak wpisów w tym okresie.</div>
          )}
        </section>
      </main>
      <div class="bottom">
        <TabBar active="history" />
      </div>
    </>
  );
}

function Bar({
  day,
  height,
  selected,
  showValue,
  onSelect,
}: {
  day: DayStat;
  height: number;
  selected: boolean;
  showValue: boolean;
  onSelect: () => void;
}) {
  const label = `${weekdayLong(day.date)}, ${shortDate(day.date)}: ${day.meals ? `${day.kcal} kcal` : 'brak wpisów'}`;
  const cls = ['chart-bar', day.isToday ? 'today' : '', selected ? 'selected' : ''].filter(Boolean).join(' ');
  return (
    <button type="button" class="chart-col" aria-label={label} aria-pressed={selected} onClick={onSelect}>
      {showValue && <span class="chart-value">{formatNumber(day.kcal)}</span>}
      {day.kcal > 0 && <span class={cls} style={{ height: `${Math.max(2, height)}px` }} />}
    </button>
  );
}

function DayRow({ day, goal }: { day: DayStat; goal: number }) {
  const over = day.kcal - goal;
  return (
    <a class="meal-row" style={{ padding: '10px 14px' }} href={day.isToday ? hrefs.today() : hrefs.day(day.date)}>
      <span class="meal-main">
        <span style={{ fontSize: '15px', fontWeight: 600 }}>
          {weekdayLong(day.date)}, {shortDate(day.date)}
        </span>
        {day.isToday ? (
          <span class="meal-meta">dziś, w trakcie</span>
        ) : over > 0 ? (
          <span class="status-over" style={{ fontSize: '13px' }}>
            <Icon name="arrowUp" size={14} strokeWidth={3} />
            {formatNumber(over)} ponad cel
          </span>
        ) : (
          <span class="status-good row" style={{ fontSize: '13px', gap: '4px' }}>
            <Icon name="check" size={14} strokeWidth={3} />w celu
          </span>
        )}
      </span>
      <span style={{ fontSize: '16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatNumber(day.kcal)} kcal</span>
    </a>
  );
}

function daysLabel(n: number): string {
  return n === 1 ? '1 dzień' : `${n} dni`;
}
