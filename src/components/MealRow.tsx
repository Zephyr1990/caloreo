import { formatNumber, sumItems } from '../lib/nutrition';
import { hrefs } from '../lib/router';
import { mealTypeLabel, type Meal } from '../lib/types';
import { Icon } from './Icon';

export function mealTitle(meal: Pick<Meal, 'name' | 'items' | 'type'>): string {
  if (meal.name.trim()) return meal.name.trim();
  const names = meal.items.map((i) => i.name.trim()).filter(Boolean);
  return names.length ? names.join(', ') : mealTypeLabel(meal.type);
}

export function MealRow({ meal }: { meal: Meal }) {
  const kcal = sumItems(meal.items).kcal;
  return (
    <a class="meal-row" href={hrefs.meal(meal.id)}>
      <span class="thumb">
        {meal.thumbnail ? (
          <img src={meal.thumbnail} alt="" />
        ) : (
          <Icon name={meal.source === 'ai' ? 'mic' : 'pencil'} size={20} />
        )}
      </span>
      <span class="meal-main">
        <span class="meal-name">{mealTitle(meal)}</span>
        <span class="meal-meta">
          {mealTypeLabel(meal.type)} · {meal.time}
        </span>
      </span>
      <span class="kcal-col">
        <strong>{formatNumber(kcal)}</strong>
        <span>kcal</span>
      </span>
    </a>
  );
}
