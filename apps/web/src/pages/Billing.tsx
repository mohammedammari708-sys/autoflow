import { CURRENT_PLAN_ID, PLANS } from '../lib/plans';
import { useI18n } from '../i18n';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/Layout';

export function BillingPage() {
  const { t } = useI18n();

  return (
    <div>
      <PageHeader title={t.billing.title} subtitle={t.billing.subtitle} />
      <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        {t.billing.paymentsNote}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const current = plan.id === CURRENT_PLAN_ID;
          return (
            <Card
              key={plan.id}
              className={`animate-fade-up flex flex-col ${current ? 'ring-2 ring-brand-500' : ''}`}
            >
              <CardBody className="flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h2>
                  {current && <Badge tone="brand">{t.billing.currentPlan}</Badge>}
                </div>
                <p className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {plan.price}
                  </span>{' '}
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    / {plan.id === 'free' ? '—' : t.billing.perMonth}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{plan.blurb}</p>
                <h3 className="mt-5 text-sm font-semibold text-slate-900 dark:text-white">{t.billing.features}</h3>
                <ul className="mt-2 flex flex-1 flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  {plan.limits.map((limit) => (
                    <li key={limit} className="flex gap-2">
                      <span aria-hidden className="text-brand-600 dark:text-brand-400">✓</span> {limit}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {current ? (
                    <Button variant="secondary" disabled className="w-full">
                      {t.billing.currentPlan}
                    </Button>
                  ) : (
                    <Button disabled title={t.billing.paymentsNotConnected} className="w-full">
                      {t.billing.upgrade} — {t.billing.paymentsNotConnected}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
