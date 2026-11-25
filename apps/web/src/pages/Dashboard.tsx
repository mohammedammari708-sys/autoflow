import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, templatesApi, workflowsApi } from '../lib/api';
import type { DashboardStats, SystemStatus, Template } from '../lib/api';
import { ApiError } from '../lib/api';
import { useI18n } from '../i18n';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge, Spinner } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/Badge';
import { PageHeader } from '../components/Layout';

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card className="animate-fade-up">
      <CardBody>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`mt-2 text-3xl font-bold tracking-tight ${accent}`}>{value}</p>
      </CardBody>
    </Card>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDay(date: string): string {
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return date;
  }
}

export function DashboardPage() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, st, tpl] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.systemStatus(),
        templatesApi.list(),
      ]);
      setStats(s);
      setStatus(st);
      setTemplates(tpl.templates.slice(0, 3));
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

  const quickCreate = async () => {
    setCreating(true);
    try {
      const { workflow } = await workflowsApi.create('Untitled workflow');
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : t.common.error, 'error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Spinner label={t.common.loading} />;
  if (error || !stats) {
    return (
      <Card>
        <EmptyState icon="⚠" title={t.common.error} hint={error} action={<Button onClick={() => void load()}>{t.common.retry}</Button>} />
      </Card>
    );
  }

  const maxDay = Math.max(1, ...stats.executionsByDay.map((d) => d.success + d.failed));

  return (
    <div>
      <PageHeader
        title={t.dashboard.title}
        subtitle={t.dashboard.subtitle}
        action={
          <Button onClick={() => void quickCreate()} loading={creating}>
            + {t.dashboard.quickCreate}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.dashboard.totalWorkflows} value={stats.totalWorkflows} accent="text-slate-900 dark:text-white" />
        <StatCard label={t.dashboard.activeWorkflows} value={stats.activeWorkflows} accent="text-brand-600 dark:text-brand-400" />
        <StatCard label={t.dashboard.totalExecutions} value={stats.totalExecutions} accent="text-slate-900 dark:text-white" />
        <div className="grid grid-cols-2 gap-4">
          <Card className="animate-fade-up">
            <CardBody>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.dashboard.successful}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {stats.successfulExecutions}
              </p>
            </CardBody>
          </Card>
          <Card className="animate-fade-up">
            <CardBody>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.dashboard.failed}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {stats.failedExecutions}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t.dashboard.executionsByDay} />
          <CardBody>
            {stats.executionsByDay.length === 0 ? (
              <EmptyState icon="📊" title={t.dashboard.noExecutionsYet} />
            ) : (
              <div className="flex h-44 items-end gap-2" role="img" aria-label={t.dashboard.executionsByDay}>
                {stats.executionsByDay.map((d) => {
                  const total = d.success + d.failed;
                  const height = Math.max(total === 0 ? 2 : (total / maxDay) * 100, 2);
                  const successShare = total === 0 ? 0 : (d.success / total) * 100;
                  return (
                    <div key={d.date} className="group flex flex-1 flex-col items-center gap-1.5">
                      <div className="relative h-32 w-full max-w-10 overflow-hidden rounded-t-lg bg-slate-100 dark:bg-slate-800">
                        <div
                          className="absolute inset-x-0 bottom-0 flex flex-col"
                          style={{ height: `${height}%` }}
                          title={`${d.date}: ${d.success} succeeded, ${d.failed} failed`}
                        >
                          <div className="bg-rose-400" style={{ height: `${100 - successShare}%` }} />
                          <div className="flex-1 bg-emerald-500" />
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDay(d.date)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> {t.dashboard.successful}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" /> {t.dashboard.failed}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.dashboard.systemStatus} />
          <CardBody>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t.dashboard.api}</dt>
                <dd>
                  <Badge tone={status?.api === 'ok' ? 'green' : 'red'}>
                    {status?.api === 'ok' ? t.dashboard.operational : (status?.api ?? '—')}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t.dashboard.database}</dt>
                <dd>
                  <Badge tone={status?.db === 'ok' ? 'green' : 'red'}>
                    {status?.db === 'ok' ? t.dashboard.operational : (status?.db ?? '—')}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t.dashboard.uptime}</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">
                  {status ? formatUptime(status.uptimeSeconds) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t.dashboard.version}</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">{status?.version ?? '—'}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t.dashboard.recentActivity}
            action={
              <Link to="/executions" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                {t.dashboard.viewAll} →
              </Link>
            }
          />
          <CardBody>
            {stats.recentActivity.length === 0 ? (
              <EmptyState icon="🕒" title={t.dashboard.noActivity} />
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {stats.recentActivity.map((a) => (
                  <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{a.detail}</p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t.dashboard.popularTemplates}
            action={
              <Link to="/templates" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                {t.dashboard.viewAll} →
              </Link>
            }
          />
          <CardBody>
            {templates.length === 0 ? (
              <EmptyState icon="📄" title={t.templates.noTemplates} />
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {templates.map((tpl) => (
                  <li key={tpl.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{tpl.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{tpl.category}</p>
                    </div>
                    <Link
                      to="/templates"
                      className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {t.common.view}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
