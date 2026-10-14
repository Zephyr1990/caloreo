import { hrefs } from '../lib/router';
import { Icon } from './Icon';

type Tab = 'day' | 'history' | 'weight' | 'settings';

const TABS: { id: Tab; label: string; href: string; icon: 'home' | 'chart' | 'scale' | 'gear' }[] = [
  { id: 'day', label: 'Dziś', href: hrefs.today(), icon: 'home' },
  { id: 'history', label: 'Historia', href: hrefs.history(), icon: 'chart' },
  { id: 'weight', label: 'Waga', href: hrefs.weight(), icon: 'scale' },
  { id: 'settings', label: 'Ustawienia', href: hrefs.settings(), icon: 'gear' },
];

export function TabBar({ active }: { active: Tab }) {
  return (
    <nav class="tabbar" aria-label="Nawigacja główna">
      {TABS.map((t) => (
        <a key={t.id} class="tab" href={t.href} aria-current={t.id === active ? 'page' : undefined}>
          <Icon name={t.icon} />
          {t.label}
        </a>
      ))}
    </nav>
  );
}
