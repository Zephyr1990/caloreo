import { useEffect, useRef, useState } from 'preact/hooks';
import { DaySummary } from '../components/DaySummary';
import { Icon } from '../components/Icon';
import { MealRow } from '../components/MealRow';
import { TabBar } from '../components/TabBar';
import { addDays, dayTitle, longDate, todayKey } from '../lib/dates';
import { mealsForDate, mealsVersion } from '../lib/db';
import { patchDraft, startDraft } from '../lib/draft';
import { addPhotos } from '../lib/flow';
import { sumMeals } from '../lib/nutrition';
import { hrefs, navigate } from '../lib/router';
import { settings } from '../lib/settings';
import { startListening } from '../lib/speech';
import type { Meal } from '../lib/types';

export function DayView({ date }: { date: string }) {
  const today = todayKey();
  const version = mealsVersion.value;
  const [meals, setMeals] = useState<Meal[] | null>(null);

  useEffect(() => {
    let alive = true;
    mealsForDate(date).then((m) => alive && setMeals(m));
    return () => {
      alive = false;
    };
  }, [date, version]);

  const totals = sumMeals(meals ?? []);
  const isToday = date === today;
  const next = addDays(date, 1);
  const hrefFor = (d: string) => (d === today ? hrefs.today() : hrefs.day(d));

  const startAdd = () => {
    startDraft(date);
    navigate(hrefs.add());
  };

  // Dictation must start inside the tap handler; the add screen then shows the live text.
  const startVoice = () => {
    startDraft(date);
    startListening({ target: 'description', base: '', onText: (description) => patchDraft({ description }) });
    navigate(hrefs.add());
  };

  const cameraRef = useRef<HTMLInputElement>(null);
  const onPhoto = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.files?.length) return;
    const files = Array.from(input.files);
    input.value = '';
    startAdd();
    void addPhotos(files);
  };

  return (
    <>
      <main class="screen with-dock">
        <header class="topbar">
          <a class="round-btn" href={hrefFor(addDays(date, -1))} aria-label="Poprzedni dzień">
            <Icon name="chevronLeft" />
          </a>
          <div class="stack" style={{ alignItems: 'center', gap: '2px' }}>
            <h1 style={{ fontSize: '22px' }}>{dayTitle(date, today)}</h1>
            <div class="small" style={{ fontSize: '14px', color: 'var(--ink-secondary)' }}>
              {longDate(date)}
            </div>
          </div>
          <button
            type="button"
            class="round-btn"
            aria-label="Następny dzień"
            disabled={date >= today}
            onClick={() => navigate(hrefFor(next))}
          >
            <Icon name="chevronRight" />
          </button>
        </header>

        <DaySummary totals={totals} goal={settings.value.dailyGoal} label={isToday ? 'Zjedzone dziś' : 'Zjedzone tego dnia'} />

        <section class="stack" aria-label="Posiłki">
          <div class="row-between" style={{ padding: '0 4px', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Posiłki</h2>
            {meals && meals.length > 0 && <span class="muted" style={{ fontSize: '14px' }}>{entriesLabel(meals.length)}</span>}
          </div>
          {meals && meals.length === 0 && (
            <div class="empty">
              {isToday
                ? 'Nic jeszcze nie zapisano. Dotknij mikrofonu i powiedz, co zjadłeś.'
                : 'Brak posiłków tego dnia.'}
            </div>
          )}
          {meals?.map((m) => <MealRow key={m.id} meal={m} />)}
        </section>
      </main>

      <div class="bottom">
        <div class="dock">
          <button type="button" class="dock-btn" aria-label="Dodaj zdjęcie posiłku" onClick={() => cameraRef.current?.click()}>
            <Icon name="camera" />
          </button>
          <input
            ref={cameraRef}
            class="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onPhoto}
          />
          <button type="button" class="dock-mic" aria-label="Powiedz, co zjadłeś" onClick={startVoice}>
            <Icon name="mic" size={30} />
          </button>
          <button type="button" class="dock-btn" aria-label="Wpisz posiłek ręcznie" onClick={startAdd}>
            <Icon name="pencil" />
          </button>
        </div>
        <TabBar active="day" />
      </div>
    </>
  );
}

function entriesLabel(n: number): string {
  if (n === 1) return '1 wpis';
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} wpisy`;
  return `${n} wpisów`;
}
