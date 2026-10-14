import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { parseNumber } from '../components/NumberField';
import { body, DEFAULT_PROFILE, updateBody } from '../lib/body';
import { addDays, isDateKey, longDate, todayKey } from '../lib/dates';
import { saveWeight } from '../lib/db';
import { formatKg, formatNumber } from '../lib/nutrition';
import { hrefs, navigate } from '../lib/router';
import { useBodyData, type BodyData } from '../lib/usePlan';
import type { ActivityLevel, Profile, Sex } from '../lib/types';
import {
  ACTIVITY_LEVELS,
  averageActivity,
  evaluatePlan,
  proposePlans,
  weightOn,
  type Evaluation,
  type PlanInput,
  type Proposal,
} from '../lib/weightPlan';

export function PlanSetupView() {
  const data = useBodyData();
  if (!data) return <main class="screen" aria-busy="true" />;
  return <PlanForm data={data} />;
}

function PlanForm({ data }: { data: BodyData }) {
  const today = todayKey();
  const existing = body.value.plan;
  const startProfile = body.value.profile ?? DEFAULT_PROFILE;
  const latest = weightOn(data.weights, today, existing?.startWeight ?? 80);

  const [sex, setSex] = useState<Sex>(startProfile.sex);
  const [birthYear, setBirthYear] = useState(String(startProfile.birthYear));
  const [height, setHeight] = useState(String(startProfile.heightCm));
  const [activity, setActivity] = useState<ActivityLevel>(startProfile.activity);
  const [current, setCurrent] = useState(formatKg(latest));
  const [target, setTarget] = useState(existing ? formatKg(existing.targetWeight) : '');
  const [date, setDate] = useState(existing?.targetDate ?? addDays(today, 84));
  const [choice, setChoice] = useState<Proposal['id'] | null>(null);

  const year = parseNumber(birthYear);
  const heightCm = parseNumber(height);
  const currentKg = parseNumber(current);
  const targetKg = parseNumber(target);
  const errors: string[] = [];
  if (year === null || year < 1920 || year > new Date().getFullYear() - 14) errors.push('Wpisz rok urodzenia, np. 1990.');
  if (heightCm === null || heightCm < 120 || heightCm > 230) errors.push('Wpisz wzrost w centymetrach, np. 183.');
  if (currentKg === null || currentKg < 30 || currentKg > 300) errors.push('Wpisz obecną wagę w kg, np. 80,0.');
  if (target.trim() && (targetKg === null || targetKg < 30 || targetKg > 300)) errors.push('Wpisz wagę docelową w kg, np. 72,0.');
  if (!isDateKey(date)) errors.push('Wybierz datę celu.');

  const profile: Profile | null =
    errors.length === 0 ? { sex, birthYear: Math.round(year!), heightCm: heightCm!, activity } : null;

  let input: PlanInput | null = null;
  let evaluation: Evaluation | null = null;
  let proposals: Proposal[] = [];
  let activitySource: 'garmin' | 'declared' = 'declared';
  if (profile && targetKg !== null && target.trim()) {
    const avg = averageActivity(data.activity, profile, currentKg!, today);
    activitySource = avg.source;
    input = { profile, currentWeight: currentKg!, targetWeight: targetKg, targetDate: date, today, activityKcal: avg.kcal };
    evaluation = evaluatePlan(input);
    proposals = proposePlans(input, evaluation);
  }
  const selected = proposals.find((p) => p.id === choice) ?? proposals[0] ?? null;
  const blocking = evaluation?.issues.some((i) => i.blocking) ?? true;
  const hasIssues = (evaluation?.issues.length ?? 0) > 0;

  const save = async (targetWeight: number, targetDate: string, acceptedUnsafe: boolean) => {
    if (!profile || currentKg === null) return;
    const kg = Math.round(currentKg * 10) / 10;
    updateBody({
      profile,
      plan: {
        startDate: today,
        startWeight: kg,
        targetWeight: Math.round(targetWeight * 10) / 10,
        targetDate,
        acceptedUnsafe,
        createdAt: new Date().toISOString(),
      },
      goalSource: 'plan',
    });
    await saveWeight({ date: today, kg, updatedAt: new Date().toISOString() });
    navigate(hrefs.weight(), { replace: true });
  };

  const removePlan = () => {
    if (!window.confirm('Usunąć plan wagi? Pomiary i aktywność zostaną. Cel kalorii wróci do ręcznego.')) return;
    updateBody({ plan: null, goalSource: 'manual' });
    navigate(hrefs.weight(), { replace: true });
  };

  const modeText = !evaluation
    ? null
    : evaluation.mode === 'loss'
      ? 'redukcja (waga docelowa niższa od obecnej)'
      : evaluation.mode === 'gain'
        ? 'przybieranie (waga docelowa wyższa od obecnej)'
        : 'utrzymanie wagi';

  return (
    <main class="screen" style={{ gap: '12px', paddingBottom: 'calc(32px + var(--safe-bottom))' }}>
      <header class="topbar">
        <a class="round-btn" href={hrefs.weight()} aria-label="Wróć">
          <Icon name="chevronLeft" />
        </a>
        <h1>Cel wagi</h1>
        <span class="spacer-44" />
      </header>

      <h2 class="section-label">Profil</h2>
      <section class="card" style={{ padding: '14px' }}>
        <div class="segmented" role="group" aria-label="Płeć" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <button type="button" aria-pressed={sex === 'male'} onClick={() => setSex('male')}>
            Mężczyzna
          </button>
          <button type="button" aria-pressed={sex === 'female'} onClick={() => setSex('female')}>
            Kobieta
          </button>
        </div>
        <div class="grid-2">
          <Field id="birth-year" label="Rok urodzenia" value={birthYear} onInput={setBirthYear} mode="numeric" />
          <Field id="height" label="Wzrost (cm)" value={height} onInput={setHeight} mode="numeric" />
        </div>
        <div class="field">
          <label class="mini-label" for="activity">
            Aktywność (na start)
          </label>
          <select
            id="activity"
            class="input compact"
            value={activity}
            onChange={(e) => setActivity(e.currentTarget.value as ActivityLevel)}
          >
            {ACTIVITY_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label} (×{String(l.factor).replace('.', ',')})
              </option>
            ))}
          </select>
          <span class="small muted">
            {activitySource === 'garmin'
              ? 'Masz już wpisy z Garmina, więc liczę z Twojej rzeczywistej aktywności.'
              : 'Po 7 dniach wpisów z Garmina liczę z Twojej rzeczywistej aktywności.'}
          </span>
        </div>
      </section>

      <h2 class="section-label">Cel</h2>
      <section class="card" style={{ padding: '14px' }}>
        <div class="grid-2">
          <Field id="current-weight" label="Waga teraz (kg)" value={current} onInput={setCurrent} mode="decimal" />
          <Field id="target-weight" label="Waga docelowa (kg)" value={target} onInput={setTarget} mode="decimal" placeholder="np. 72,0" />
        </div>
        <div class="field">
          <label class="mini-label" for="target-date">
            Data celu
          </label>
          <input
            id="target-date"
            class="input compact"
            type="date"
            min={addDays(today, 1)}
            value={date}
            onInput={(e) => setDate(e.currentTarget.value)}
          />
        </div>
        {modeText && (
          <div class="small" style={{ color: 'var(--ink-secondary)' }}>
            Tryb: <strong style={{ color: 'var(--ink)' }}>{modeText}</strong>
          </div>
        )}
      </section>

      {errors.length > 0 && (
        <div class="error" role="alert">
          {errors.join(' ')}
        </div>
      )}

      {evaluation && (
        <section class="card" aria-label="Sprawdzenie planu" style={{ padding: '14px' }}>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>Sprawdzenie planu</div>
          <div class="grid-3">
            <div class="stack" style={{ gap: '2px' }}>
              <span class="stat-label">Zapotrzebowanie</span>
              <span class="stat-value" style={{ fontSize: '17px' }}>
                {formatNumber(evaluation.maintenance)} kcal
              </span>
            </div>
            <div class="stack" style={{ gap: '2px' }}>
              <span class="stat-label">{evaluation.dailyDelta >= 0 ? 'Potrzebny deficyt' : 'Potrzebna nadwyżka'}</span>
              <span class="stat-value" style={{ fontSize: '17px' }}>
                {formatNumber(Math.abs(evaluation.dailyDelta))} kcal
              </span>
            </div>
            <div class="stack" style={{ gap: '2px' }}>
              <span class="stat-label">Tempo</span>
              <span class="stat-value" style={{ fontSize: '17px' }}>
                {String(Math.round(evaluation.weeklyKg * 100) / 100).replace('.', ',')} kg/tydz.
              </span>
            </div>
          </div>
          {hasIssues ? (
            evaluation.issues.map((issue) => (
              <div key={issue.code} class="warn-box" role="alert">
                <span style={{ color: 'var(--warn)' }}>
                  <Icon name="warning" size={20} />
                </span>
                <div>
                  <strong>{issue.title}</strong>
                  {issue.message}
                </div>
              </div>
            ))
          ) : (
            <div class="status-pill good">
              <Icon name="check" size={16} strokeWidth={3} />
              Plan mieści się w progach: {formatNumber(evaluation.dailyTarget)} kcal dziennie
            </div>
          )}
        </section>
      )}

      {proposals.length > 0 && (
        <fieldset class="stack" style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: '16px', fontWeight: 800, padding: '0 0 0 4px', marginBottom: '8px' }}>Propozycje</legend>
          {proposals.map((p, i) => (
            <label key={p.id} class="option">
              <input type="radio" name="proposal" checked={selected?.id === p.id} onChange={() => setChoice(p.id)} />
              <span class="stack" style={{ gap: '2px' }}>
                <span class="option-kicker">
                  {String.fromCharCode(65 + i)} · {p.title}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>
                  {formatKg(p.targetWeight)} kg do {longDate(p.targetDate).split(', ')[1]} {p.targetDate.slice(0, 4)}
                </span>
                <span class="small" style={{ color: 'var(--ink-secondary)', fontSize: '14px' }}>
                  {formatNumber(p.evaluation.dailyTarget)} kcal dziennie ·{' '}
                  {String(Math.round(p.evaluation.weeklyKg * 100) / 100).replace('.', ',')} kg/tydz.
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {evaluation && !hasIssues && (
        <button type="button" class="btn btn-primary" onClick={() => save(input!.targetWeight, input!.targetDate, false)}>
          <Icon name="check" size={20} strokeWidth={2.5} />
          Zapisz plan
        </button>
      )}
      {selected && (
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => save(selected.targetWeight, selected.targetDate, false)}
        >
          <Icon name="check" size={20} strokeWidth={2.5} />
          Zapisz plan {String.fromCharCode(65 + proposals.indexOf(selected))}
        </button>
      )}
      {evaluation && hasIssues && !blocking && (
        <button
          type="button"
          class="btn btn-danger"
          onClick={() =>
            window.confirm('Twój plan przekracza bezpieczne progi. Zapisać mimo to?') &&
            void save(input!.targetWeight, input!.targetDate, true)
          }
        >
          Zapisz mój plan mimo ostrzeżenia
        </button>
      )}
      {existing && (
        <button type="button" class="btn btn-ghost" onClick={removePlan}>
          Usuń plan
        </button>
      )}
      <p class="small muted" style={{ textAlign: 'center', margin: 0 }}>
        Szacunek z ogólnych wzorów, nie porada medyczna.
      </p>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onInput,
  mode,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onInput: (v: string) => void;
  mode: 'numeric' | 'decimal';
  placeholder?: string;
}) {
  return (
    <div class="field">
      <label class="mini-label" for={id}>
        {label}
      </label>
      <input
        id={id}
        class="input compact"
        type="text"
        inputMode={mode}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onInput={(e) => onInput(e.currentTarget.value)}
        style={{ fontSize: '17px', fontWeight: 600 }}
      />
    </div>
  );
}
