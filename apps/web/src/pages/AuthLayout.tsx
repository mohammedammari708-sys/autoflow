import type { ReactNode } from 'react';
import { Logo } from '../components/ui/Sidebar';
import { useI18n } from '../i18n';

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          {t.common.appName} — {t.common.tagline}
        </p>
      </div>
    </div>
  );
}
