import { daysBetween } from '../lib/weightPlan';
import { addDays, shortDate } from '../lib/dates';
import { formatKg } from '../lib/nutrition';
import type { WeightEntry, WeightPlan } from '../lib/types';

const W = 326;
const H = 170;
const X0 = 34;
const X1 = 318;
const Y0 = 12;
const Y1 = 140;

function niceStep(range: number): number {
  for (const s of [0.5, 1, 2, 5, 10, 20]) if (range / s <= 4) return s;
  return 50;
}

/** Weigh-ins as a line with dots, on top of the plan drawn as a dashed line. */
export function WeightChart({ weights, plan }: { weights: readonly WeightEntry[]; plan: WeightPlan | null }) {
  const points = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (points.length === 0 && !plan) return null;
  const dates = [...points.map((p) => p.date), ...(plan ? [plan.startDate, plan.targetDate] : [])].sort();
  const start = dates[0];
  const end = dates[dates.length - 1];
  const span = Math.max(1, daysBetween(start, end));
  const values = [...points.map((p) => p.kg), ...(plan ? [plan.startWeight, plan.targetWeight] : [])];
  const step = niceStep(Math.max(...values) - Math.min(...values) || 1);
  const lo = Math.floor((Math.min(...values) - step / 2) / step) * step;
  const hi = Math.ceil((Math.max(...values) + step / 2) / step) * step;
  const x = (d: string) => X0 + (daysBetween(start, d) / span) * (X1 - X0);
  const y = (kg: number) => Y0 + ((hi - kg) / (hi - lo)) * (Y1 - Y0);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  const shownTicks = ticks.length > 4 ? ticks.filter((_, i) => i % 2 === 0) : ticks;
  const last = points.at(-1);
  const label = points.length
    ? `Wykres wagi: od ${formatKg(points[0].kg)} kg ${shortDate(points[0].date)} do ${formatKg(last!.kg)} kg ${shortDate(last!.date)}${plan ? `, plan do ${formatKg(plan.targetWeight)} kg ${shortDate(plan.targetDate)}` : ''}.`
    : 'Wykres wagi bez pomiarów.';

  return (
    <figure class="card" style={{ margin: 0, gap: '8px' }}>
      <figcaption style={{ fontSize: '15px', fontWeight: 700 }}>{plan ? 'Waga na tle planu' : 'Waga'}</figcaption>
      <div class="row" style={{ gap: '16px', fontSize: '13px', color: 'var(--ink-2)' }} aria-hidden="true">
        <span class="row" style={{ gap: '6px' }}>
          <svg width="22" height="10" viewBox="0 0 22 10">
            <path d="M1 5h20" stroke="var(--accent)" stroke-width="2" />
            <circle cx="11" cy="5" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" />
          </svg>
          Pomiary
        </span>
        {plan && (
          <span class="row" style={{ gap: '6px' }}>
            <svg width="22" height="10" viewBox="0 0 22 10">
              <path d="M1 5h20" stroke="var(--ink-muted)" stroke-width="2" stroke-dasharray="5 4" />
            </svg>
            Plan
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
        {shownTicks.map((t) => (
          <g key={t}>
            <path d={`M${X0} ${y(t)}H${X1}`} stroke="var(--line)" stroke-width="1" />
            <text x={X0 - 6} y={y(t) + 4} font-size="11" fill="var(--ink-secondary)" text-anchor="end">
              {Number.isInteger(t) ? t : formatKg(t)}
            </text>
          </g>
        ))}
        <path d={`M${X0} ${Y1}H${X1}`} stroke="var(--line-strong)" stroke-width="1" />
        {plan && (
          <>
            <path
              d={`M${x(plan.startDate)} ${y(plan.startWeight)}L${x(plan.targetDate)} ${y(plan.targetWeight)}`}
              stroke="var(--ink-muted)"
              stroke-width="2"
              stroke-dasharray="5 4"
              fill="none"
            />
            <circle cx={x(plan.targetDate)} cy={y(plan.targetWeight)} r="4" fill="var(--surface)" stroke="var(--ink-muted)" stroke-width="2" />
          </>
        )}
        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${x(p.date)},${y(p.kg)}`).join(' ')}
            fill="none"
            stroke="var(--accent)"
            stroke-width="2"
            stroke-linejoin="round"
          />
        )}
        {points.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" />
        ))}
        {last && (
          <text
            x={Math.min(x(last.date) + 7, X1 - 30)}
            y={y(last.kg) - 7}
            font-size="12"
            font-weight="700"
            fill="var(--ink)"
          >
            {formatKg(last.kg)}
          </text>
        )}
        <text x={X0} y={H - 10} font-size="11" fill="var(--ink-secondary)" text-anchor="start">
          {shortDate(start)}
        </text>
        {span >= 14 && (
          <text x={(X0 + X1) / 2} y={H - 10} font-size="11" fill="var(--ink-secondary)" text-anchor="middle">
            {shortDate(addDays(start, Math.round(span / 2)))}
          </text>
        )}
        <text x={X1} y={H - 10} font-size="11" fill="var(--ink-secondary)" text-anchor="end">
          {shortDate(end)}
        </text>
      </svg>
    </figure>
  );
}

