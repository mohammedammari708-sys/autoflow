import { NavLink } from 'react-router-dom';
import { useI18n } from '../../i18n';

export const NAV_ITEMS = [
  { to: '/', key: 'dashboard', icon: 'grid', end: true },
  { to: '/workflows', key: 'workflows', icon: 'flow', end: false },
  { to: '/templates', key: 'templates', icon: 'stack', end: false },
  { to: '/integrations', key: 'integrations', icon: 'plug', end: false },
  { to: '/ai', key: 'ai', icon: 'spark', end: false },
  { to: '/executions', key: 'executions', icon: 'clock', end: false },
  { to: '/settings', key: 'settings', icon: 'gear', end: false },
  { to: '/billing', key: 'billing', icon: 'card', end: false },
] as const;

function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'flow':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <path d="M8 7.5 10.5 15.5M16 7.5 13.5 15.5M8.5 6h7" />
        </svg>
      );
    case 'stack':
      return (
        <svg {...common}>
          <path d="M12 3 3 8l9 5 9-5-9-5Z" />
          <path d="m3 13 9 5 9-5" />
        </svg>
      );
    case 'plug':
      return (
        <svg {...common}>
          <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7Z" />
          <path d="M12 16v5" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.36.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.38 2.54a7 7 0 0 0-2.42 1.4l-2.36-.95-2 3.46 2 1.55a7 7 0 0 0 0 2.8l-2 1.55 2 3.46 2.36-.95a7 7 0 0 0 2.42 1.4l.38 2.54h3.4l.38-2.54a7 7 0 0 0 2.42-1.4l2.36.95 2-3.46-2-1.55c.1-.45.14-.92.14-1.4Z" />
        </svg>
      );
    case 'card':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M7 15h4" />
        </svg>
      );
    default:
      return null;
  }
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="6" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="18" cy="7" r="2.5" fill="#fbbf24" stroke="none" />
          <circle cx="18" cy="17" r="2.5" fill="currentColor" stroke="none" opacity="0.7" />
          <path d="M8.3 11 15.5 8M8.3 13 15.5 16" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-base font-bold tracking-tight text-slate-900 dark:text-white">
            AutoFlow
          </span>
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Automate Everything. Simply.
          </span>
        </span>
      )}
    </span>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`
          }
        >
          <Icon name={item.icon} />
          {t.nav[item.key as keyof typeof t.nav]}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col border-e border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="px-4 pb-4 pt-5">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="text-xs text-slate-400 dark:text-slate-500">AutoFlow v0.1.0 · Phase 1</p>
      </div>
    </div>
  );
}

/** Mobile bottom navigation: the five primary destinations. */
export function BottomNav() {
  const { t } = useI18n();
  const items = NAV_ITEMS.slice(0, 5);
  return (
    <nav
      aria-label="Main mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                isActive
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
              }`
            }
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {t.nav[item.key as keyof typeof t.nav]}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
