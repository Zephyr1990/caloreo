import { useEffect, useRef, useState } from 'preact/hooks';
import { ActivityCard } from '../components/ActivityCard';
import { DayBalance } from '../components/DayBalance';
import { DaySummary, type PlanLine } from '../components/DaySummary';
import { Icon } from '../components/Icon';
import { MealRow } from '../components/MealRow';
import { TabBar } from '../components/TabBar';
import { addDays, dayTitle, longDate, shortDate, todayKey } from '../lib/dates';
import { mealsForDate, mealsVersion } from '../lib/db';
import { patchDraft, startDraft } from '../lib/draft';
import { addPhotos } from '../lib/flow';
import { body } from '../lib/body';
import { formatKg, formatNumber, sumMeals } from '../lib/nutrition';
import { hrefs, navigate } from '../lib/router';
import { startListening } from '../lib/speech';
import type { Meal } from '../lib/types';
import { useBalanceSummary, useGoal } from '../lib/usePlan';
import { dayEnergy, weightOn, type BalanceSummary, type PlanStatus } from '../lib/weightPlan';

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
  const { goal, fromPlan, status, data } = useGoal();
  const profile = body.value.profile;
  const plan = body.value.plan;
  const weightKg = weightOn(data?.weights ?? [], date, plan?.startWeight ?? data?.weights[0]?.kg ?? 80);
  const yesterday = addDays(today, -1);
  // Remind about yesterday's Garmin data only to someone who already enters it.
  const remindYesterday =
    date === today && profile !== null && !!data && data.activity.length > 0 && !data.activity.some((a) => a.date === yesterday);
  const isToday = date === today;
  const week = useBalanceSummary(profile, fromPlan ? status : null, data, today);
  // Past days without meals have no balance worth showing.
  const showBalance = meals !== null && data !== null && (isToday || meals.length > 0);
  const energy = showBalance && profile ? dayEnergy(profile, weightKg, date, totals.kcal, data.activity) : null;
  const planDelta = status && status.state === 'active' ? status.dailyDelta : null;
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

        <DaySummary
          totals={totals}
          goal={goal}
          label={isToday ? 'Zjedzone dziś' : 'Zjedzone tego dnia'}
          planLine={fromPlan && status ? planLine(status, week) : null}
        >
          {showBalance && (
            <DayBalance
              key={date}
              energy={energy}
              isToday={isToday}
              goal={goal}
              planDelta={planDelta}
              onEnter={() => enterActivity(date)}
            />
          )}
        </DaySummary>

        {remindYesterday && (
          <a class="reminder" href={hrefs.day(yesterday)}>
            <Icon name="flame" size={20} />
            <span style={{ flex: 1 }}>Uzupełnij aktywność z wczoraj</span>
            <Icon name="chevronRight" size={18} />
          </a>
        )}

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

        {meals && <ActivityCard date={date} />}
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

/** Scrolls to the Garmin field and focuses it, so the keyboard opens right away. */
function enterActivity(date: string) {
  const field = document.getElementById(`active-${date}`);
  if (!field) return;
  field.scrollIntoView({ block: 'center', behavior: 'smooth' });
  field.focus({ preventScroll: true });
}

function planLine(s: PlanStatus, week: BalanceSummary | null): PlanLine {
  const p = s.plan;
  const title = `Cel z planu wagi: ${formatKg(p.targetWeight)} kg do ${shortDate(p.targetDate)}`;
  if (s.state === 'reached') return { title: 'Cel wagi osiągnięty', detail: 'cel kalorii na utrzymanie wagi' };
  if (s.state === 'expired') return { title, detail: 'termin minął, cel kalorii na utrzymanie wagi' };
  const kind = s.dailyDelta >= 0 ? 'deficyt' : 'nadwyżka';
  const plan = formatNumber(Math.abs(s.dailyDelta));
  if (week && week.avg7 !== null) {
    const span = week.count7 >= 7 ? '7 dni' : `${week.count7} z 7 dni`;
    const avgKind = week.avg7 >= 0 ? 'deficytu' : 'nadwyżki';
    const sameWay = (week.avg7 >= 0) === (s.dailyDelta >= 0);
    return {
      title,
      detail: `${span}: średnio ${formatNumber(Math.abs(week.avg7))} kcal ${avgKind} · plan\u00a0${sameWay ? plan : `${kind}\u00a0${plan}`}`,
    };
  }
  const weekly = String(Math.round(((Math.abs(s.dailyDelta) * 7) / 7700) * 100) / 100).replace('.', ',');
  return { title, detail: `${kind} ${plan} kcal · ${weekly} kg na tydzień` };
}
