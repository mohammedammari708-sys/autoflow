import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { executionsApi } from '../lib/api';
import type { Execution, ExecutionLog } from '../lib/api';
import { ApiError } from '../lib/api';
import { useI18n } from '../i18n';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody } from '../components/ui/Card';
import { EmptyState, Spinner } from '../components/ui/Badge';
import { PageHeader } from '../components/Layout';

function statusTone(status?: string): 'green' | 'red' | 'slate' {
  if (status === 'success') return 'green';
  if (status === 'failed') return 'red';
  return 'slate';
}

function levelTone(level: string): 'green' | 'red' | 'amber' | 'slate' {
  const l = level.toLowerCase();
  if (l === 'error') return 'red';
  if (l === 'warn' || l === 'warning') return 'amber';
  if (l === 'info') return 'green';
  return 'slate';
}

function fmtDate(value?: string): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function ExecutionDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const [execution, setExecution] = useState<Execution | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    executionsApi
      .detail(id)
      .then(({ execution: ex, logs: ls }) => {
        if (cancelled) return;
        setExecution(ex);
        setLogs(ls);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t.common.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (loading) return <Spinner label={t.common.loading} />;

  return (
    <div>
      <PageHeader title={t.executions.detailTitle} subtitle={id} />
      <div className="mb-3">
        <Link
          to="/executions"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-soft hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          ← {t.executions.backToExecutions}
        </Link>
      </div>
      {error || !execution ? (
        <Card>
          <EmptyState
            icon="⚠"
            title={error ? t.common.error : t.executions.notFound}
            hint={error || undefined}
            action={
              <Button onClick={() => window.location.reload()}>{t.common.retry}</Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <Card>
            <CardBody className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(execution.status)}>
                  {execution.status === 'success'
                    ? t.executions.success
                    : execution.status === 'failed'
                      ? t.executions.failed
                      : (execution.status ?? '—')}
                </Badge>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {execution.workflowName ?? execution.workflowId ?? '—'}
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">{t.executions.startedAt}</dt>
                  <dd className="text-end text-slate-800 dark:text-slate-100">{fmtDate(execution.startedAt)}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">{t.executions.finishedAt}</dt>
                  <dd className="text-end text-slate-800 dark:text-slate-100">{fmtDate(execution.finishedAt)}</dd>
                </div>
              </dl>
              {execution.error && (
                <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  {execution.error}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
                {t.executions.logs} ({logs.length})
              </h2>
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.executions.noLogs}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {logs.map((log) => (
                    <li
                      key={log.id}
                      className="flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/60"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={levelTone(log.level)}>{log.level}</Badge>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                          {log.nodeId}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                        {log.message}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

export function ExecutionsPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
    if (id) return; // Detail view loads its own data.
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (id) return <ExecutionDetail id={id} />;
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
                    <th className="px-5 py-3 font-medium"><span className="sr-only">{t.executions.viewDetails}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((ex) => (
                    <tr
                      key={ex.id}
                      onClick={() => navigate(`/executions/${ex.id}`)}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-5 py-3">
                        <Badge tone={statusTone(ex.status)}>
                          {ex.status === 'success'
                            ? t.executions.success
                            : ex.status === 'failed'
                              ? t.executions.failed
                              : (ex.status ?? '—')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {ex.workflowName ?? ex.workflowId ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{fmtDate(ex.startedAt)}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{fmtDate(ex.finishedAt)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex min-h-[44px] items-center rounded-xl px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
                          {t.executions.viewDetails} →
                        </span>
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
