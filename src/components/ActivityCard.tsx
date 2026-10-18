import { useEffect, useState } from 'preact/hooks';
import { bodyVersion, deleteActivity, getActivity, saveActivity } from '../lib/db';
import type { ActivityEntry } from '../lib/types';
import { parseNumber } from './NumberField';

const toText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(Math.round(n)));

/** Garmin active calories (and optional steps) for one day; the balance is in the summary card. */
export function ActivityCard({ date }: { date: string }) {
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
    </section>
  );
}
