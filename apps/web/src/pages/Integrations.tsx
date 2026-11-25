import { useEffect, useMemo, useState } from 'react';
import { integrationsApi } from '../lib/api';
import type { Integration } from '../lib/api';
import { ApiError } from '../lib/api';
import { useI18n } from '../i18n';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Badge, EmptyState, Spinner } from '../components/ui/Badge';
import { PageHeader } from '../components/Layout';

export function IntegrationsPage() {
  const { t } = useI18n();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    integrationsApi
      .list()
      .then(({ integrations: list }) => setIntegrations(list))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : t.common.error))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Integration[]>();
    for (const item of integrations) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [integrations]);

  if (loading) return <Spinner label={t.common.loading} />;

  return (
    <div>
      <PageHeader title={t.integrations.title} subtitle={t.integrations.subtitle} />
      <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        {t.integrations.connectNote}
      </p>

      {error ? (
        <Card>
          <EmptyState icon="⚠" title={t.common.error} hint={error} />
        </Card>
      ) : integrations.length === 0 ? (
        <Card>
          <EmptyState icon="🔌" title={t.common.noResults} />
        </Card>
      ) : (
        grouped.map(([category, items]) => (
          <section key={category} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Card key={item.id} className="animate-fade-up flex flex-col">
                  <CardBody className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{item.name}</h3>
                      <Badge tone="slate">{t.common.notConfigured}</Badge>
                    </div>
                    <p className="mt-1.5 flex-1 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                    <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                      {t.integrations.authType}: {item.authType}
                    </p>
                    <div className="mt-4">
                      <Button size="sm" disabled title={t.integrations.availablePhase4} className="w-full">
                        {t.integrations.connect} — {t.integrations.availablePhase4}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
