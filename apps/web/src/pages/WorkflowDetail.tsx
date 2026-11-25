import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { workflowsApi } from '../lib/api';
import type { Workflow } from '../lib/api';
import { ApiError } from '../lib/api';
import { useI18n } from '../i18n';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge, EmptyState, Spinner } from '../components/ui/Badge';
import { Field, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/Layout';

// Lazy-load the editor (React Flow) so other pages don't pay its bundle cost.
const WorkflowEditor = lazy(() =>
  import('../components/workflow/WorkflowEditor').then((m) => ({ default: m.WorkflowEditor })),
);

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    workflowsApi
      .get(id)
      .then(({ workflow: w }) => {
        setWorkflow(w);
        setDescription(w.description ?? '');
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : t.common.error);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <Spinner label={t.common.loading} />;
  if (error || !workflow) {
    return (
      <div>
        <PageHeader title={t.workflowDetail.notFound} />
        <Card>
          <EmptyState
            icon="⚠"
            title={t.workflowDetail.notFound}
            hint={error}
            action={
              <Link to="/workflows">
                <Button variant="secondary">← {t.nav.workflows}</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const saveDescription = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const { workflow: w } = await workflowsApi.update(id, {
        description: description.trim(),
      });
      setWorkflow(w);
      toast.push(t.workflowDetail.saved, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : t.common.error, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!id) return;
    setToggling(true);
    try {
      const { workflow: w } = await workflowsApi.update(id, { active: !workflow.active });
      setWorkflow(w);
      toast.push(t.workflowDetail.saved, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : t.common.error, 'error');
    } finally {
      setToggling(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'workflow'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await workflowsApi.remove(id);
      toast.push(t.workflowDetail.deleted, 'success');
      navigate('/workflows');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : t.common.error, 'error');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const nodeCount = workflow.definition?.nodes.length ?? 0;
  const edgeCount = workflow.definition?.edges.length ?? 0;

  return (
    <div>
      <PageHeader
        title={workflow.name}
        subtitle={`${nodeCount} ${t.workflowDetail.nodes} · ${edgeCount} ${t.workflowDetail.edges} · ${t.common.updated} ${new Date(workflow.updatedAt).toLocaleString()}`}
        action={
          <Link to="/workflows">
            <Button variant="secondary">← {t.nav.workflows}</Button>
          </Link>
        }
      />

      {/* Visual editor — full-bleed within the page column for max canvas room */}
      <div className="-mx-4 sm:-mx-6">
        <Suspense fallback={<Spinner label={t.common.loading} />}>
          <WorkflowEditor workflow={workflow} onSaved={setWorkflow} />
        </Suspense>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title={t.common.edit} />
            <CardBody>
              <form onSubmit={saveDescription} className="flex flex-col gap-4">
                <Field label={t.workflows.description}>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" loading={saving}>
                    {t.workflowDetail.saveChanges}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t.workflowDetail.definition}
              action={
                <Button size="sm" variant="secondary" onClick={exportJson}>
                  ⬇ {t.workflowDetail.exportJson}
                </Button>
              }
            />
            <CardBody>
              <pre className="json-view max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-emerald-200 dark:bg-black">
                {JSON.stringify(workflow.definition ?? { nodes: [], edges: [] }, null, 2)}
              </pre>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t.common.actions} />
            <CardBody className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {workflow.active ? t.workflowDetail.activeLabel : t.workflowDetail.inactiveLabel}
                </span>
                <Badge tone={workflow.active ? 'green' : 'slate'}>
                  {workflow.active ? t.common.active : t.common.inactive}
                </Badge>
              </div>
              <Button variant="secondary" loading={toggling} onClick={() => void toggleActive()} className="w-full">
                {workflow.active ? t.common.inactive : t.common.active}
              </Button>
              <Button variant="secondary" onClick={exportJson} className="w-full">
                ⬇ {t.workflowDetail.exportJson}
              </Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)} className="w-full">
                {t.workflowDetail.deleteWorkflow}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t.workflows.deleteTitle}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>{workflow.name}</strong> — {t.workflows.deleteConfirm}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
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
