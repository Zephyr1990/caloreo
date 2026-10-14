import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { parseNumber } from '../components/NumberField';
import { TabBar } from '../components/TabBar';
import { WeightChart } from '../components/WeightChart';
import { body, updateBody } from '../lib/body';
import { addDays, longDate, shortDate, todayKey, weekdayShort } from '../lib/dates';
import { deleteWeight, mealsInRange, mealsVersion, saveWeight } from '../lib/db';
import { formatKg, formatKgDelta, formatNumber, sumItems } from '../lib/nutrition';
import { hrefs } from '../lib/router';
import { useGoal, type BodyData } from '../lib/usePlan';
import {
  ACTIVITY_LEVELS,
  ACTIVITY_MIN_DAYS,
  dayBalance,
  summarizeBalance,
  weightOn,
  type BalanceSummary,
  type PlanStatus,
} from '../lib/weightPlan';
import type { Meal, Profile } from '../lib/types';

const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

function dayMonth(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function WeightView() {
  const today = todayKey();
  const { status, data } = useGoal();
  const { profile, plan } = body.value;
  const weights = data?.weights ?? [];
  const todayEntry = weights.find((w) => w.date === today);

  return (
    <>
      <main class="screen with-tabbar">
        <header class="row-between" style={{ minHeight: '44px' }}>
          <h1 class="page-title">Waga</h1>
          <a class="btn btn-ghost" style={{ background: 'var(--surface)', borderRadius: '22px', minHeight: '44px' }} href={hrefs.weightPlan()}>
            <Icon name="pencil" size={18} />
            {plan ? 'Zmień plan' : 'Ustaw cel'}
          </a>
        </header>

        {status ? (
          <PlanCard status={status} />
        ) : (
          data && (
            <section class="card">
              <div style={{ fontSize: '18px', fontWeight: 800 }}>Ustaw cel wagi</div>
              <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.5, color: 'var(--ink-2)' }}>
                Podaj wagę docelową i datę. Policzę dzienny deficyt (albo nadwyżkę) i cel kalorii, sprawdzę, czy plan jest
                rozsądny, i będę go przeliczać po każdym ważeniu.
              </p>
              <a class="btn btn-primary" href={hrefs.weightPlan()}>
                Ustaw cel wagi
              </a>
            </section>
          )
        )}

        {status && profile && data && <BalanceCard profile={profile} status={status} data={data} today={today} />}

        {data && <TodayWeight key={todayEntry?.updatedAt ?? 'none'} today={today} initial={todayEntry?.kg ?? null} />}

        {(weights.length > 0 || plan) && data && <WeightChart weights={weights} plan={plan} />}

        {weights.length > 0 && (
          <section class="stack" aria-label="Pomiary">
            <h2 style={{ margin: '0 0 0 4px', fontSize: '17px', fontWeight: 800 }}>Pomiary</h2>
            <div class="card" style={{ padding: '4px 14px', gap: 0 }}>
              {[...weights]
                .reverse()
                .slice(0, 14)
                .map((w, i, list) => {
                  const prev = list[i + 1];
                  return (
                    <div key={w.date} class="list-row">
                      <span style={{ fontSize: '15px' }}>
                        {weekdayShort(w.date)}, {shortDate(w.date)}
                      </span>
                      <span class="row" style={{ gap: '12px' }}>
                        {prev && <span class="small muted">{formatKgDelta(w.kg - prev.kg)}</span>}
                        <span style={{ fontSize: '16px', fontWeight: 700 }}>{formatKg(w.kg)} kg</span>
                        <button
                          type="button"
                          class="round-btn"
                          style={{ background: 'transparent', color: 'var(--ink-muted)' }}
                          aria-label={`Usuń pomiar z ${shortDate(w.date)}`}
                          onClick={() => window.confirm(`Usunąć pomiar z ${shortDate(w.date)}?`) && void deleteWeight(w.date)}
                        >
                          <Icon name="trash" size={18} />
                        </button>
                      </span>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
      </main>
      <div class="bottom">
        <TabBar active="weight" />
      </div>
    </>
  );
}

function PlanCard({ status }: { status: PlanStatus }) {
  const s = status;
  const p = s.plan;
  const mode = p.targetWeight < p.startWeight ? 'Redukcja' : p.targetWeight > p.startWeight ? 'Przybieranie' : 'Utrzymanie';
  const losing = p.targetWeight < p.startWeight;
  const left = Math.max(0, s.totalKg - s.doneKg);
  const behind = losing ? s.offTrackKg : -s.offTrackKg;
  const weekly = (Math.abs(s.dailyDelta) * 7) / 7700;
  const activityLabel = ACTIVITY_LEVELS.find((l) => l.id === body.value.profile?.activity)?.label.split(':')[0] ?? '';

  let pill: { text: string; good: boolean };
  if (s.state === 'reached') pill = { text: 'Cel osiągnięty', good: true };
  else if (s.state === 'expired') pill = { text: 'Termin minął', good: false };
  else if (Math.abs(behind) < 0.3) pill = { text: 'Zgodnie z planem', good: true };
  else if (behind > 0) pill = { text: `${formatKg(behind)} kg za planem, cel przeliczony`, good: false };
  else pill = { text: `${formatKg(-behind)} kg przed planem`, good: true };

  const applySuggestion = () => {
    if (!s.suggestion) return;
    updateBody({ plan: { ...p, targetDate: s.suggestion.targetDate } });
  };

  return (
    <section class="card" aria-label="Postęp planu">
      <div class="label">
        {mode}: {formatKg(p.targetWeight)} kg do {dayMonth(p.targetDate)}
      </div>
      <div class="hero" style={{ marginTop: '-4px' }}>
        <span class="hero-value" style={{ fontSize: '48px' }}>
          {formatKg(s.currentWeight)}
        </span>
        <span class="hero-unit">kg teraz</span>
      </div>
      <div class="meter" role="img" aria-label={`Postęp: ${formatKg(Math.max(0, s.doneKg))} z ${formatKg(s.totalKg)} kilogramów`}>
        <div class="meter-fill" style={{ width: `${Math.round(s.progress * 100)}%` }} />
      </div>
      <div class="row-between" style={{ fontSize: '15px' }}>
        <span class="status-good">
          {losing ? 'Schudłeś' : 'Przybrałeś'} {formatKg(Math.max(0, s.doneKg))} kg
        </span>
        <span class="muted">
          zostało {formatKg(left)} kg{s.state === 'active' ? ` · ${s.daysLeft} dni` : ''}
        </span>
      </div>
      <span class={pill.good ? 'status-pill good' : 'status-pill'}>
        <Icon name={pill.good ? 'check' : 'info'} size={16} strokeWidth={pill.good ? 3 : 2} />
        {pill.text}
      </span>

      {s.state !== 'active' && (
        <div class="small muted">
          {s.state === 'reached'
            ? 'Dzienny cel kalorii jest teraz na utrzymanie wagi. Możesz ustawić nowy cel.'
            : 'Dzienny cel kalorii jest teraz na utrzymanie wagi. Ustaw nową datę lub nowy cel.'}
        </div>
      )}

      {s.clamped && (
        <div class="warn-box" role="alert">
          <span style={{ color: 'var(--warn)' }}>
            <Icon name="warning" size={20} />
          </span>
          <div>
            <strong>Plan wymaga za szybkiego tempa</strong>
            Dzienny cel trzymam w bezpiecznych progach, więc do {dayMonth(p.targetDate)} możesz nie zdążyć.
            {s.suggestion && ` Realny termin: ${longDate(s.suggestion.targetDate)}.`}
          </div>
        </div>
      )}
      {s.clamped && s.suggestion && (
        <button type="button" class="btn btn-outline" onClick={applySuggestion}>
          Przesuń datę na {dayMonth(s.suggestion.targetDate)}
        </button>
      )}

      <hr class="divider" />
      <div class="grid-3">
        <div class="stack" style={{ gap: '2px' }}>
          <span class="stat-label">Dzienny cel</span>
          <span class="stat-value">{formatNumber(s.dailyTarget)} kcal</span>
        </div>
        <div class="stack" style={{ gap: '2px' }}>
          <span class="stat-label">{s.dailyDelta >= 0 ? 'Potrzebny deficyt' : 'Potrzebna nadwyżka'}</span>
          <span class="stat-value">{formatNumber(Math.abs(s.dailyDelta))} kcal</span>
        </div>
        <div class="stack" style={{ gap: '2px' }}>
          <span class="stat-label">Tempo</span>
          <span class="stat-value">{String(Math.round(weekly * 100) / 100).replace('.', ',')} kg/tydz.</span>
        </div>
      </div>
      <div class="small muted">
        {s.activity.source === 'garmin'
          ? `Aktywność: średnio ${formatNumber(s.activity.kcal)} kcal dziennie z Garmina (${s.activity.count} dni).`
          : `Aktywność: ${activityLabel.toLowerCase()}, ok. ${formatNumber(s.activity.kcal)} kcal dziennie, do czasu ${ACTIVITY_MIN_DAYS} dni wpisów z Garmina.`}
      </div>
    </section>
  );
}

function BalanceCard({ profile, status, data, today }: { profile: Profile; status: PlanStatus; data: BodyData; today: string }) {
  const version = mealsVersion.value;
  const since = status.plan.startDate;
  const weekAgo = addDays(today, -7);
  const from = since < weekAgo ? since : weekAgo;
  const [meals, setMeals] = useState<Meal[] | null>(null);

  useEffect(() => {
    let alive = true;
    mealsInRange(from, addDays(today, -1)).then((m) => alive && setMeals(m));
    return () => {
      alive = false;
    };
  }, [from, today, version]);

  let summary: BalanceSummary | null = null;
  if (meals) {
    const eatenByDate = new Map<string, number>();
    for (const m of meals) eatenByDate.set(m.date, (eatenByDate.get(m.date) ?? 0) + sumItems(m.items).kcal);
    const days = [...eatenByDate.entries()].map(([date, eaten]) =>
      dayBalance(
        profile,
        weightOn(data.weights, date, status.plan.startWeight),
        date,
        eaten,
        data.activity.find((a) => a.date === date),
      ),
    );
    summary = summarizeBalance(days, today, since);
  }

  const planDelta = status.dailyDelta;
  const measured = status.plan.startWeight - status.currentWeight;

  return (
    <section class="card" aria-label="Bilans">
      <div class="row-between" style={{ alignItems: 'baseline' }}>
        <div style={{ fontSize: '16px', fontWeight: 800 }}>Bilans</div>
        <div class="small muted">zjedzone wobec spalonych</div>
      </div>
      {summary && summary.countSum === 0 && summary.count7 === 0 ? (
        <div class="small muted" style={{ lineHeight: 1.5 }}>
          Bilans pojawi się, gdy będą pełne dni z posiłkami i kaloriami aktywnymi z Garmina (karta „Aktywność” na ekranie
          Dziś).
        </div>
      ) : (
        summary && (
          <div class="grid-2">
            <div class="stack" style={{ gap: '2px', background: 'var(--bg)', borderRadius: '12px', padding: '12px' }}>
              <span class="stat-label">{summary.avg7 !== null && summary.avg7 < 0 ? 'Średnia nadwyżka' : 'Średni deficyt'}, 7 dni</span>
              <span style={{ fontSize: '22px', fontWeight: 700 }}>
                {summary.avg7 === null ? '–' : `${formatNumber(Math.abs(summary.avg7))} kcal`}
              </span>
              <span class="small muted">
                plan: {formatNumber(Math.abs(planDelta))} kcal · {summary.count7} dni
              </span>
            </div>
            <div class="stack" style={{ gap: '2px', background: 'var(--bg)', borderRadius: '12px', padding: '12px' }}>
              <span class="stat-label">Od startu ({summary.countSum} dni z danymi)</span>
              <span style={{ fontSize: '22px', fontWeight: 700 }}>{formatNumber(summary.sum)} kcal</span>
              <span class="small muted">
                ok. {formatKgDelta(-summary.kgEstimate)} kg · waga {formatKgDelta(-measured)} kg
              </span>
            </div>
          </div>
        )
      )}
    </section>
  );
}

function TodayWeight({ today, initial }: { today: string; initial: number | null }) {
  const [text, setText] = useState(initial === null ? '' : formatKg(initial));
  const [saved, setSaved] = useState(false);
  const value = parseNumber(text);
  const valid = value !== null && value >= 30 && value <= 300;

  const save = async () => {
    if (!valid) return;
    await saveWeight({ date: today, kg: Math.round(value * 10) / 10, updatedAt: new Date().toISOString() });
    setSaved(true);
  };

  return (
    <section class="card" style={{ gap: '6px', padding: '12px 14px' }} aria-label="Pomiar z dziś">
      <label class="label" for="weight-today">
        Dzisiejsza waga (kg)
      </label>
      <div class="row">
        <input
          id="weight-today"
          class="input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="np. 79,5"
          value={text}
          onInput={(e) => {
            setText(e.currentTarget.value);
            setSaved(false);
          }}
          style={{ flex: 1, minWidth: 0, fontSize: '18px', fontWeight: 600 }}
        />
        <button type="button" class="btn btn-primary" style={{ minHeight: '48px' }} disabled={!valid} onClick={save}>
          {saved ? 'Zapisano' : 'Zapisz'}
        </button>
      </div>
      <div class="small muted">Najlepiej rano, na czczo. Plan przeliczy się po zapisaniu.</div>
    </section>
  );
}
