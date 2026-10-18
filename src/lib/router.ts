import { signal } from '@preact/signals';
import { isDateKey } from './dates';

export type Route =
  | { name: 'day'; date: string | null }
  | { name: 'add' }
  | { name: 'meal'; id: string }
  | { name: 'history' }
  | { name: 'weight' }
  | { name: 'weightPlan' }
  | { name: 'frequent' }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  switch (parts[0]) {
    case undefined:
      return { name: 'day', date: null };
    case 'day':
      return { name: 'day', date: parts[1] && isDateKey(parts[1]) ? parts[1] : null };
    case 'add':
      return { name: 'add' };
    case 'meal':
      return parts[1] ? { name: 'meal', id: decodeURIComponent(parts[1]) } : { name: 'day', date: null };
    case 'history':
      return { name: 'history' };
    case 'weight':
      return parts[1] === 'plan' ? { name: 'weightPlan' } : { name: 'weight' };
    case 'frequent':
      return { name: 'frequent' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'day', date: null };
  }
}

export const hrefs = {
  today: () => '#/',
  day: (date: string) => `#/day/${date}`,
  add: () => '#/add',
  meal: (id: string) => `#/meal/${encodeURIComponent(id)}`,
  history: () => '#/history',
  weight: () => '#/weight',
  weightPlan: () => '#/weight/plan',
  frequent: () => '#/frequent',
  settings: () => '#/settings',
};

const hasWindow = typeof window !== 'undefined';

export const route = signal<Route>(parseHash(hasWindow ? window.location.hash : ''));

if (hasWindow) {
  window.addEventListener('hashchange', () => {
    route.value = parseHash(window.location.hash);
    window.scrollTo(0, 0);
  });
}

export function navigate(hash: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) {
    history.replaceState(null, '', hash);
    route.value = parseHash(hash);
    window.scrollTo(0, 0);
  } else {
    window.location.hash = hash;
  }
}
