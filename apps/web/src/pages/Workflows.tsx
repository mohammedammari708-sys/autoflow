import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { workflowsApi } from '../lib/api';
import type { Workflow } from '../lib/api';
import { ApiError } from '../lib/api';
import { useI18n } from '../i18n';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Badge, EmptyState, Spinner } from '../components/ui/Badge';
import { Field, Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/Layout';

type Filter = 'all' | 'active' | 'inactive';

export function WorkflowsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { workflows: list } = await workflowsApi.list();
      setWorkflows(list);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workflows.filter((w) => {
      if (filter === 'active' && !w.active) return false;
      if (filter === 'inactive' && w.active) return false;
      if (q && !`${w.name} ${w.description ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [workflows, search, filter]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { workflow } = await workflowsApi.create(name.trim(), description.trim() || undefined);
      setCreateOpen(false);
      setName('');
      setDescription('');
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : t.common.error, 'error');
    } finally {
      setCreating(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await workflowsApi.remove(deleteTarget.id);
      setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      toast.push(t.workflowDetail.deleted, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : t.common.error, 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) return <Spinner label={t.common.loading} />;

  return (
    <div>
      <PageHeader
        title={t.workflows.title}
        subtitle={t.workflows.subtitle}
        action={<Button onClick={() => setCreateOpen(true)}>+ {t.workflows.createWorkflow}</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.workflows.searchPlaceholder}
            aria-label={t.workflows.searchPlaceholder}
          />
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Filter">
          <option value="all">{t.workflows.filterAll}</option>
          <option value="active">{t.workflows.filterActive}</option>
          <option value="inactive">{t.workflows.filterInactive}</option>
        </Select>
      </div>

      {error ? (
        <Card>
          <EmptyState icon="⚠" title={t.common.error} hint={error} action={<Button onClick={() => void load()}>{t.common.retry}</Button>} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          {workflows.length === 0 ? (
            <EmptyState
              icon="⚡"
              title={t.workflows.noWorkflows}
              hint={t.workflows.noWorkflowsHint}
              action={<Button onClick={() => setCreateOpen(true)}>+ {t.workflows.createWorkflow}</Button>}
            />
          ) : (
            <EmptyState icon="🔍" title={t.common.noResults} />
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <Card key={w.id} className="animate-fade-up flex flex-col transition hover:shadow-lift">
              <CardBody className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    <Link to={`/workflows/${w.id}`} className="hover:text-brand-700 dark:hover:text-brand-300">
                      {w.name}
                    </Link>
                  </h2>
                  <Badge tone={w.active ? 'green' : 'slate'}>
                    {w.active ? t.common.active : t.common.inactive}
                  </Badge>
                </div>
                <p className="mt-1.5 flex-1 text-sm text-slate-500 dark:text-slate-400">
                  {w.description || '—'}
                </p>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                  {t.common.updated} {new Date(w.updatedAt).toLocaleDateString()}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/workflows/${w.id}`)} className="flex-1">
                    {t.common.view}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(w)} aria-label={`Delete ${w.name}`}>
                    🗑
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t.workflows.createTitle}>
        <form onSubmit={create} className="flex flex-col gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.workflows.createHint}</p>
          <Field label={t.workflows.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.workflows.namePlaceholder} autoFocus required />
          </Field>
          <Field label={`${t.workflows.description} (${t.common.optional})`}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.workflows.descriptionPlaceholder} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" loading={creating}>
              {t.common.create}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title={t.workflows.deleteTitle}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>{deleteTarget?.name}</strong> — {t.workflows.deleteConfirm}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" loading={deleting} onClick={() => void remove()}>
            {t.common.delete}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
