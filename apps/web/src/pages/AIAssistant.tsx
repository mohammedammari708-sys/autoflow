import { useI18n } from '../i18n';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/Layout';

export function AIAssistantPage() {
  const { t } = useI18n();

  return (
    <div>
      <PageHeader title={t.ai.title} />
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader title={t.ai.requiresConfig} action={<Badge tone="amber">Phase 5</Badge>} />
          <CardBody>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t.ai.explanation}</p>
            <h3 className="mt-6 text-sm font-semibold text-slate-900 dark:text-white">{t.ai.whatNeeded}</h3>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex gap-2">
                <span aria-hidden className="text-brand-600 dark:text-brand-400">•</span> {t.ai.need1}
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-brand-600 dark:text-brand-400">•</span> {t.ai.need2}
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-brand-600 dark:text-brand-400">•</span> {t.ai.need3}
              </li>
            </ul>
            <div className="mt-6">
              <label htmlFor="ai-input" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.ai.title}
              </label>
              <textarea
                id="ai-input"
                rows={3}
                disabled
                placeholder={t.ai.inputPlaceholder}
                className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-400 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{t.ai.disabledNote}</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
