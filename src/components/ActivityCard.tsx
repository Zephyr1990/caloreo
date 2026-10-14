import { useEffect, useState } from 'preact/hooks';
import { body } from '../lib/body';
import { bodyVersion, deleteActivity, getActivity, saveActivity } from '../lib/db';
import { formatNumber } from '../lib/nutrition';
import { hrefs } from '../lib/router';
import type { ActivityEntry } from '../lib/types';
import { dayBalance, type PlanStatus } from '../lib/weightPlan';
import { parseNumber } from './NumberField';

interface Props {
  date: string;
  /** Calories eaten that day. */
  eaten: number;
  weightKg: number;
  status: PlanStatus | null;
}

const toText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(Math.round(n)));

/** Garmin active calories (and optional steps) for one day, with that day's energy balance. */
export function ActivityCard({ date, eaten, weightKg, status }: Props) {
  const version = bodyVersion.value;
  const [entry, setEntry] = useState<ActivityEntry | null>(null);
  const [kcal, setKcal] = useState('');
  const [steps, setSteps] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    getActivity(date).then((e) => {
      if (!alive) return;
      setEntry(e ?? null);
      setKcal(toText(e?.activeKcal));
      setSteps(toText(e?.steps));
    });
    return () => {
      alive = false;
    };
  }, [date, version]);

  const kcalValue = kcal.trim() ? parseNumber(kcal.replace(/\s/g, '')) : null;
  const stepsValue = steps.trim() ? parseNumber(steps.replace(/\s/g, '')) : null;
  const invalid = (kcal.trim() !== '' && (kcalValue === null || kcalValue > 10000)) || (steps.trim() !== '' && (stepsValue === null || stepsValue > 200000));
  const dirty = kcal !== toText(entry?.activeKcal) || steps !== toText(entry?.steps);

  const save = async () => {
    if (invalid) return;
    if (kcalValue === null && stepsValue === null) {
      await deleteActivity(date);
    } else {
      await saveActivity({
        date,
        activeKcal: kcalValue === null ? null : Math.round(kcalValue),
        steps: stepsValue === null ? null : Math.round(stepsValue),
        updatedAt: new Date().toISOString(),
      });
    }
    setSaved(true);
  };

  const profile = body.value.profile;
  const balance = profile ? dayBalance(profile, weightKg, date, eaten, entry ?? undefined) : null;

  return (
    <section class="card" aria-label="Aktywność">
      <div class="row-between" style={{ alignItems: 'baseline' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Aktywność</h2>
        <span class="small" style={{ color: 'var(--ink-secondary)' }}>
          z Garmina, wieczorem lub jutro
        </span>
      </div>
      <div class="grid-2">
        <div class="field">
          <label class="mini-label" for={`active-${date}`}>
            Kalorie aktywne
          </label>
          <input
            id={`active-${date}`}
            class="input compact"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="np. 650"
            value={kcal}
            onInput={(e) => {
              setKcal(e.currentTarget.value);
              setSaved(false);
            }}
          />
        </div>
        <div class="field">
          <label class="mini-label" for={`steps-${date}`}>
            Kroki (opcjonalnie)
          </label>
          <input
            id={`steps-${date}`}
            class="input compact"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="np. 10000"
            value={steps}
            onInput={(e) => {
              setSteps(e.currentTarget.value);
              setSaved(false);
            }}
          />
        </div>
      </div>
      <div class="small muted">
        Kalorie aktywne z podsumowania dnia w Garmin Connect obejmują kroki i treningi. Kroki są tylko do podglądu.
      </div>
      {invalid && (
        <div class="small" style={{ color: 'var(--warn)', fontWeight: 600 }} role="alert">
          Wpisz liczbę, np. 650 kcal i 10000 kroków.
        </div>
      )}
      {(dirty || saved) && (
        <button type="button" class="btn btn-outline" disabled={!dirty || invalid} onClick={save}>
          {dirty ? 'Zapisz aktywność' : 'Zapisano'}
        </button>
      )}

      {balance ? (
        <div class="balance" aria-label="Bilans dnia">
          <div class="row-between">
            <span class="muted">Podstawa</span>
            <span>{formatNumber(balance.base)} kcal</span>
          </div>
          <div class="row-between">
            <span class="muted">Aktywność (Garmin)</span>
            <span>{balance.activeKcal === null ? 'brak' : `+ ${formatNumber(balance.activeKcal)} kcal`}</span>
          </div>
          {balance.burned !== null && (
            <div class="row-between" style={{ fontWeight: 700 }}>
              <span>Spalone</span>
              <span>{formatNumber(balance.burned)} kcal</span>
            </div>
          )}
          <div class="row-between">
            <span class="muted">Zjedzone</span>
            <span>− {formatNumber(eaten)} kcal</span>
          </div>
          <hr class="divider" />
          {balance.balance === null ? (
            <div class="small muted">Wpisz kalorie aktywne, aby zobaczyć bilans dnia.</div>
          ) : (
            <div class="row-between" style={{ alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700 }}>{balance.balance >= 0 ? 'Deficyt dnia' : 'Nadwyżka dnia'}</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: balance.balance >= 0 ? 'var(--accent)' : 'var(--warn)' }}>
                {formatNumber(Math.abs(balance.balance))} kcal
              </span>
            </div>
          )}
          {status && status.state === 'active' && (
            <div class="small muted">
              Plan wymaga średnio {formatNumber(Math.abs(status.dailyDelta))} kcal{' '}
              {status.dailyDelta >= 0 ? 'deficytu' : 'nadwyżki'} dziennie.
            </div>
          )}
        </div>
      ) : (
        <div class="small muted">
          <a href={hrefs.weightPlan()}>Ustaw profil i cel wagi</a>, aby liczyć bilans dnia.
        </div>
      )}
    </section>
  );
}
