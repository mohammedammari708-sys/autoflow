import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { templatesApi } from '../lib/api';
import type { Template } from '../lib/api';
import { ApiError } from '../lib/api';
import { useI18n } from '../i18n';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Badge, EmptyState, Spinner } from '../components/ui/Badge';
import { Field, Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/Layout';

export function TemplatesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Template | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [importName, setImportName] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    templatesApi
      .list()
      .then(({ templates: list }) => setTemplates(list))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : t.common.error))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (tpl: Template) => {
    setSelected(tpl);
    setImportName(tpl.name);
    setDetailLoading(true);
    try {
      const { template } = await templatesApi.get(tpl.id);
      setSelected(template);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : t.common.error, 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const doImport = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setImporting(true);
    try {
      const { workflow } = await templatesApi.import(selected.id, importName.trim() || undefined);
      toast.push(t.templates.imported, 'success');
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : t.common.error, 'error');
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <Spinner label={t.common.loading} />;

  return (
    <div>
      <PageHeader title={t.templates.title} subtitle={t.templates.subtitle} />

      {error ? (
        <Card>
          <EmptyState icon="⚠" title={t.common.error} hint={error} />
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <EmptyState icon="📄" title={t.templates.noTemplates} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="animate-fade-up flex flex-col transition hover:shadow-lift">
              <CardBody className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">{tpl.name}</h2>
                  <Badge tone="brand">{tpl.category}</Badge>
                </div>
                <p className="mt-1.5 flex-1 text-sm text-slate-500 dark:text-slate-400">{tpl.description}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void openDetail(tpl)} className="flex-1">
                    {t.common.view}
                  </Button>
                  <Button size="sm" onClick={() => void openDetail(tpl)} className="flex-1">
                    {t.templates.import}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={t.templates.importTitle} wide>
        {selected && (
          <form onSubmit={doImport} className="flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{selected.name}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selected.description}</p>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {t.templates.category}: {selected.category}
              </p>
            </div>
            <Field label={t.templates.importAs}>
              <Input value={importName} onChange={(e) => setImportName(e.target.value)} required />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.templates.definitionPreview}
              </p>
              {detailLoading ? (
                <Spinner label={t.common.loading} />
              ) : (
                <pre className="json-view max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-emerald-200 dark:bg-black">
                  {JSON.stringify(selected.definition ?? { nodes: [], edges: [] }, null, 2)}
                </pre>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.templates.importHint}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" loading={importing}>
                {t.templates.import}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
