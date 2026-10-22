import Icon from './Icon.jsx';
import { BOOKING_URL } from '../config.js';

const TABS = [
  { id: 'hjem', label: 'Hjem', icon: 'home', href: '#/' },
  { id: 'meldinger', label: 'Meldinger', icon: 'chat', href: '#/meldinger' },
  { id: 'book', label: 'Book', icon: 'calendar', href: BOOKING_URL, external: true },
  { id: 'turnering', label: 'Turnering', icon: 'trophy', href: '#/turnering' },
];

export default function TabBar({ active }) {
  const current = active === 'info' ? 'hjem' : active;
  return (
    <nav className="tabbar" aria-label="Hovedmeny">
      {TABS.map((t) => {
        const on = t.id === current;
        return (
          <a key={t.id} href={t.href} className={on ? 'tab tab-on' : 'tab'}
            aria-current={on ? 'page' : undefined}
            {...(t.external ? { target: '_blank', rel: 'noopener' } : {})}>
            <Icon name={t.icon} strokeWidth={on ? 2 : 1.8} />
            <span>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
