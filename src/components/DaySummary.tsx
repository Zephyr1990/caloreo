import { energyShares, formatGrams, formatNumber, goalProgress } from '../lib/nutrition';
import { hrefs } from '../lib/router';
import type { Totals } from '../lib/types';
import { Icon } from './Icon';

export interface PlanLine {
  title: string;
  detail: string;
}

export function DaySummary({
  totals,
  goal,
  label,
  planLine = null,
}: {
  totals: Totals;
  goal: number;
  label: string;
  planLine?: PlanLine | null;
}) {
  const p = goalProgress(totals.kcal, goal);
  const over = p.over > 0;
  return (
    <section class="card" aria-label="Podsumowanie dnia">
      <div class="label">{label}</div>
      <div class="hero" style={{ marginTop: '-6px' }}>
        <span class="hero-value">{formatNumber(totals.kcal)}</span>
        <span class="hero-unit">/ {formatNumber(goal)} kcal</span>
      </div>
      <div
        class={over ? 'meter over' : 'meter'}
        role="img"
        aria-label={`${p.percent} procent celu dziennego`}
      >
        <div class="meter-fill" style={{ width: `${Math.min(100, p.percent)}%` }} />
      </div>
      <div class="row-between" style={{ fontSize: '15px' }}>
        {over ? (
          <span class="status-over">
            <Icon name="arrowUp" size={16} strokeWidth={3} />
            {formatNumber(p.over)} kcal ponad cel
          </span>
        ) : (
          <span class="status-good">Zostało {formatNumber(p.remaining)} kcal</span>
        )}
        <span class="muted">{p.percent}% celu</span>
      </div>
      {planLine && (
        <a class="plan-line" href={hrefs.weight()}>
          <span class="plan-line-icon">
            <Icon name="scale" size={18} />
          </span>
          <span class="stack" style={{ gap: 0, flex: 1 }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>{planLine.title}</span>
            <span class="small" style={{ color: 'var(--ink-secondary)' }}>
              {planLine.detail}
            </span>
          </span>
          <Icon name="chevronRight" size={18} />
        </a>
      )}
      <hr class="divider" />
      <MacroSummary totals={totals} />
    </section>
  );
}

export function MacroSummary({ totals }: { totals: Totals }) {
  const shares = energyShares(totals);
  const hasEnergy = shares.protein + shares.fat + shares.carbs > 0;
  const macros = [
    { key: 'protein', label: 'Białko', grams: totals.protein, share: shares.protein, cls: 'bg-protein' },
    { key: 'fat', label: 'Tłuszcz', grams: totals.fat, share: shares.fat, cls: 'bg-fat' },
    { key: 'carbs', label: 'Węglowodany', grams: totals.carbs, share: shares.carbs, cls: 'bg-carbs' },
  ] as const;
  return (
    <>
      <div
        class="split-bar"
        role="img"
        aria-label={
          hasEnergy
            ? `Udział w energii: białko ${shares.protein} procent, tłuszcz ${shares.fat} procent, węglowodany ${shares.carbs} procent`
            : 'Brak danych o makroskładnikach'
        }
      >
        {hasEnergy ? (
          macros
            .filter((m) => m.share > 0)
            .map((m) => <div key={m.key} class={m.cls} style={{ width: `${m.share}%` }} />)
        ) : (
          <div class="split-empty" />
        )}
      </div>
      <div class="macro-grid">
        {macros.map((m) => (
          <div key={m.key} class="stack" style={{ gap: '2px' }}>
            <div class="macro-label">
              <span class={`swatch ${m.cls}`} />
              {m.label}
            </div>
            <div class="macro-value">{formatGrams(m.grams)} g</div>
            <div class="small muted">{m.share}% energii</div>
          </div>
        ))}
      </div>
    </>
  );
}
