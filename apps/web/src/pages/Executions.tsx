import { useEffect, useState } from 'react';
import { executionsApi } from '../lib/api';
import type { Execution } from '../lib/api';
import { ApiError } from '../lib/api';
import { useI18n } from '../i18n';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { EmptyState, Spinner } from '../components/ui/Badge';
import { PageHeader } from '../components/Layout';

export function ExecutionsPage() {
  const { t } = useI18n();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { executions: list } = await executionsApi.list();
      setExecutions(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Spinner label={t.common.loading} />;

  return (
    <div>
      <PageHeader title={t.executions.title} subtitle={t.executions.subtitle} />
      {error ? (
        <Card>
          <EmptyState icon="⚠" title={t.common.error} hint={error} action={<Button onClick={() => void load()}>{t.common.retry}</Button>} />
        </Card>
      ) : executions.length === 0 ? (
        <Card>
          <EmptyState icon="▶" title={t.executions.noExecutions} hint={t.executions.noExecutionsHint} />
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-5 py-3 font-medium">{t.executions.status}</th>
                    <th className="px-5 py-3 font-medium">{t.executions.workflow}</th>
                    <th className="px-5 py-3 font-medium">{t.executions.startedAt}</th>
                    <th className="px-5 py-3 font-medium">{t.executions.finishedAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((ex) => (
                    <tr key={ex.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{ex.status ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{ex.workflowId ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {ex.startedAt ? new Date(ex.startedAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {ex.finishedAt ? new Date(ex.finishedAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
