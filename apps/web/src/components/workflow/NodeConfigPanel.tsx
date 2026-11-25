// Config panel for the selected node (or edge).
// Desktop: a floating panel over the right side of the canvas.
// Mobile: a bottom sheet over the canvas, with a backdrop to dismiss.
// Edits the node's label and its config key-values; complex values
// (arrays / objects) are edited as JSON, with invalid JSON rejected.
import { useState } from 'react';
import type { Edge } from '@xyflow/react';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Input';
import type { FlowNode } from './nodes';
import { defaultNameFor, nodeKind } from './nodeTypes';

interface PanelProps {
  open: boolean;
  node: FlowNode | null;
  edge: Edge | null;
  nodes: FlowNode[];
  onRename: (id: string, label: string) => void;
  onConfigValue: (id: string, key: string, value: unknown) => void;
  onConfigDelete: (id: string, key: string) => void;
  onConfigAdd: (id: string, key: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onClose: () => void;
}

function nodeName(nodes: FlowNode[], id: string): string {
  return nodes.find((n) => n.id === id)?.data.label ?? id;
}

function ConfigRow({
  nodeId,
  configKey,
  value,
  onChange,
  onDelete,
}: {
  nodeId: string;
  configKey: string;
  value: unknown;
  onChange: (id: string, key: string, value: unknown) => void;
  onDelete: (id: string, key: string) => void;
}) {
  const { t } = useI18n();
  const [jsonError, setJsonError] = useState(false);
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  const isComplex = Array.isArray(value) || (typeof value === 'object' && value !== null);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <code className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
          {configKey}
        </code>
        <button
          type="button"
          onClick={() => onDelete(nodeId, configKey)}
          aria-label={`${t.common.delete} ${configKey}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
        >
          ✕
        </button>
      </div>
      {typeof value === 'boolean' ? (
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(nodeId, configKey, e.target.checked)}
            className="h-5 w-5 accent-teal-600"
          />
          {value ? 'true' : 'false'}
        </label>
      ) : isComplex ? (
        <>
          <Textarea
            value={jsonDraft ?? JSON.stringify(value, null, 2)}
            onChange={(e) => setJsonDraft(e.target.value)}
            onBlur={(e) => {
              try {
                onChange(nodeId, configKey, JSON.parse(e.target.value) as unknown);
                setJsonDraft(null);
                setJsonError(false);
              } catch {
                setJsonError(true);
              }
            }}
            className="font-mono text-xs"
          />
          {jsonError && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{t.editor.invalidJson}</p>
          )}
        </>
      ) : (
        <Input
          value={typeof value === 'number' ? String(value) : (value as string) ?? ''}
          inputMode={typeof value === 'number' ? 'decimal' : 'text'}
          onChange={(e) => {
            if (typeof value === 'number') {
              const n = Number(e.target.value);
              onChange(nodeId, configKey, e.target.value === '' ? 0 : Number.isNaN(n) ? value : n);
            } else {
              onChange(nodeId, configKey, e.target.value);
            }
          }}
        />
      )}
    </div>
  );
}

export function NodeConfigPanel({
  open,
  node,
  edge,
  nodes,
  onRename,
  onConfigValue,
  onConfigDelete,
  onConfigAdd,
  onDeleteNode,
  onDeleteEdge,
  onClose,
}: PanelProps) {
  const { t } = useI18n();
  const [newKey, setNewKey] = useState('');

  if (!open || (!node && !edge)) return null;

  const panel = (
    <div
      role="dialog"
      aria-label={node ? node.data.label : t.editor.connection}
      className="flex max-h-[70vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-lift dark:border-slate-700 dark:bg-slate-900 md:max-h-full md:w-80 md:rounded-2xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {node ? node.data.label : t.editor.connection}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.editor.closePanel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
        {node && (
          <>
            <Field label={t.editor.nodeName}>
              <Input
                value={node.data.label}
                onChange={(e) => onRename(node.id, e.target.value)}
                placeholder={defaultNameFor(node.data.nodeType)}
              />
            </Field>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.editor.nodeType}: <code className="font-semibold">{node.data.nodeType}</code>
              {' · '}
              {nodeKind(node.data.nodeType) === 'trigger' ? t.editor.triggers : nodeKind(node.data.nodeType) === 'action' ? t.editor.actions : t.editor.unknownType}
            </p>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.editor.config}
              </p>
              {Object.entries(node.data.config).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.editor.configEmpty}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {Object.entries(node.data.config).map(([key, value]) => (
                    <ConfigRow
                      key={key}
                      nodeId={node.id}
                      configKey={key}
                      value={value}
                      onChange={onConfigValue}
                      onDelete={onConfigDelete}
                    />
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={t.editor.settingKey}
                  aria-label={t.editor.settingKey}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!newKey.trim() || newKey.trim() in node.data.config}
                  onClick={() => {
                    onConfigAdd(node.id, newKey.trim());
                    setNewKey('');
                  }}
                  className="min-h-[44px] shrink-0"
                >
                  + {t.editor.addSetting}
                </Button>
              </div>
            </div>

            <Button variant="danger" onClick={() => onDeleteNode(node.id)} className="min-h-[44px] w-full">
              {t.editor.deleteNode}
            </Button>
          </>
        )}

        {edge && !node && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t.editor.from}: <strong>{nodeName(nodes, edge.source)}</strong>
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t.editor.to}: <strong>{nodeName(nodes, edge.target)}</strong>
            </p>
            <Button variant="danger" onClick={() => onDeleteEdge(edge.id)} className="min-h-[44px] w-full">
              {t.editor.deleteEdge}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile bottom-sheet backdrop — confined to the canvas so the
          editor toolbar (Save / Run) stays tappable while the sheet is open. */}
      <div
        aria-hidden
        className="absolute inset-0 z-40 bg-slate-950/40 md:hidden"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 animate-fade-up md:absolute md:inset-x-auto md:bottom-auto md:end-3 md:top-3 md:z-10 md:w-80">
        {panel}
      </div>
    </>
  );
}
