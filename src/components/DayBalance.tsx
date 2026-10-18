import { useState } from 'preact/hooks';
import { formatNumber } from '../lib/nutrition';
import { hrefs } from '../lib/router';
import { ESTIMATE_MIN_DAYS, ESTIMATE_WINDOW_DAYS, forecastBalance, planFit, round10, type DayEnergy } from '../lib/weightPlan';
import { Icon } from './Icon';

interface Props {
  /** null without a profile: there is nothing to compute the base burn from. */
  energy: DayEnergy | null;
  isToday: boolean;
  goal: number;
  /** The plan's daily deficit (positive) or surplus (negative); null without an active plan. */
  planDelta: number | null;
  /** Takes the user to the Garmin fields. */
  onEnter: () => void;
}

/** Burned, eaten and the deficit or surplus of a day, for the summary card. */
export function DayBalance({ energy, isToday, goal, planDelta, onEnter }: Props) {
  const [open, setOpen] = useState(false);

  if (!energy) {
    return (
      <>
        <hr class="divider" />
        <div class="small muted">
          <a href={hrefs.weightPlan()}>Ustaw profil w zakładce Waga</a>, aby widzieć bilans dnia.
        </div>
      </>
    );
  }

  const estimated = energy.activitySource !== 'entered';
  const deficit = energy.balance >= 0;
  const kcal = (n: number) => (estimated ? `ok. ${formatNumber(round10(n))}` : formatNumber(n));
  const forecast = isToday && estimated && energy.eaten < goal ? forecastBalance(energy, goal) : null;

  return (
    <>
      <hr class="divider" />
      <div class="row-between">
        <span style={{ fontSize: '14px', fontWeight: 700 }}>{isToday && estimated ? 'Bilans na teraz' : 'Bilans dnia'}</span>
        {estimated ? (
          <span class="tag">szacunek</span>
        ) : (
          <span class="tag good">
            <Icon name="check" size={13} strokeWidth={3} />z Garmina
          </span>
        )}
      </div>
      <div class="kpis" role="group" aria-label={isToday && estimated ? 'Bilans na teraz' : 'Bilans dnia'}>
        <button
          type="button"
          class={estimated ? 'kpi estimated' : 'kpi'}
          aria-expanded={open}
          aria-controls="burn-breakdown"
          onClick={() => setOpen(!open)}
        >
          <span class="kpi-label">Spalone</span>
          <span class="kpi-value">{kcal(energy.burned)}</span>
          <span class="kpi-unit">kcal</span>
        </button>
        <div class="kpi">
          <span class="kpi-label">Zjedzone</span>
          <span class="kpi-value">{formatNumber(energy.eaten)}</span>
          <span class="kpi-unit">kcal</span>
        </div>
        <div class={`kpi ${deficit ? 'good' : 'over'}${estimated ? ' estimated' : ''}`}>
          <span class="kpi-label">
            {deficit ? (
              'Deficyt'
            ) : (
              <>
                <Icon name="arrowUp" size={12} strokeWidth={3} />
                Nadwyżka
              </>
            )}
          </span>
          <span class="kpi-value">{kcal(Math.abs(energy.balance))}</span>
          <span class="kpi-unit">kcal</span>
        </div>
      </div>

      {open && (
        <div id="burn-breakdown" class="balance" aria-label="Rozbicie spalonych">
          <div class="row-between">
            <span class="muted">Podstawa</span>
            <span>{kcal(energy.base)} kcal</span>
          </div>
          <div class="row-between">
            <span class="muted">{activityLabel(energy)}</span>
            <span>+ {kcal(energy.activeKcal)} kcal</span>
          </div>
        </div>
      )}

      {forecast !== null ? (
        <div class="small" style={{ color: 'var(--ink-secondary)' }}>
          Jeśli zjesz resztę celu ({formatNumber(goal - energy.eaten)} kcal), {forecast >= 0 ? 'deficyt' : 'nadwyżka'} wyniesie
          ok.&nbsp;{formatNumber(round10(Math.abs(forecast)))}&nbsp;kcal{planDelta ? `, plan\u00a0${planText(forecast, planDelta)}` : ''}.
        </div>
      ) : (
        planDelta !== null && <FitLine balance={energy.balance} planDelta={planDelta} />
      )}

      {estimated && (
        <>
          <div class="small muted">{estimateNote(energy)}</div>
          <button type="button" class="btn btn-outline" onClick={onEnter}>
            <Icon name="pencil" size={18} />
            Wpisz z Garmina
          </button>
        </>
      )}
    </>
  );
}

function FitLine({ balance, planDelta }: { balance: number; planDelta: number }) {
  const fit = planFit(balance, planDelta);
  if (!fit) return null;
  const n = `${formatNumber(Math.abs(planDelta))} kcal`;
  if (fit === 'opposite') {
    return (
      <div class="fit over">
        <Icon name="info" size={14} />
        {planDelta > 0 ? `Nadwyżka, a plan wymaga deficytu (${n})` : `Deficyt, a plan wymaga nadwyżki (${n})`}
      </div>
    );
  }
  if (fit === 'less') return <div class="fit">Mniej niż wymaga plan ({n})</div>;
  return (
    <div class="fit good">
      <Icon name="check" size={14} strokeWidth={3} />
      {fit === 'on' ? `Zgodnie z planem (${n})` : `Więcej niż wymaga plan (${n})`}
    </div>
  );
}

/** "880" when the forecast goes the plan's way, else "deficyt 880" so the direction is clear. */
function planText(forecast: number, planDelta: number): string {
  const n = formatNumber(Math.abs(planDelta));
  if (Math.sign(forecast) === Math.sign(planDelta)) return n;
  return `${planDelta > 0 ? 'deficyt' : 'nadwyżka'} ${n}`;
}

function activityLabel(e: DayEnergy): string {
  if (e.activitySource === 'entered') return 'Aktywność (Garmin)';
  if (e.activitySource === 'average') return `Aktywność (średnia z ${e.activityDays} dni)`;
  return 'Aktywność (z profilu)';
}

function estimateNote(e: DayEnergy): string {
  const kcal = formatNumber(round10(e.activeKcal));
  const source =
    e.activitySource === 'average'
      ? `Szacunek ze średniej aktywności z ostatnich ${ESTIMATE_WINDOW_DAYS} dni (${kcal}\u00a0kcal${e.activityDays < ESTIMATE_WINDOW_DAYS ? `, wpisy z ${e.activityDays} dni` : ''}).`
      : `Szacunek z poziomu aktywności w profilu (${kcal}\u00a0kcal), bo w ostatnich ${ESTIMATE_WINDOW_DAYS} dniach jest mniej niż ${ESTIMATE_MIN_DAYS} wpisy z Garmina.`;
  return `${source} Dokładny bilans po wpisaniu kalorii aktywnych z Garmina.`;
}
