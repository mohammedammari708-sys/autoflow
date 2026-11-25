// Node palette: the list of steps that can be added to the canvas.
// Desktop: a vertical list beside the canvas (drag onto the canvas or click).
// Mobile: a horizontally scrollable chip row above the canvas (tap to add
// at the canvas centre); collapsible so the canvas gets the full screen.
import type { DragEvent } from 'react';
import { useI18n } from '../../i18n';
import { PALETTE } from './nodeTypes';
import type { NodeKind } from './nodeTypes';

interface PaletteProps {
  open: boolean;
  onToggle: () => void;
  onAdd: (type: string) => void;
  onDragStart: (e: DragEvent, type: string) => void;
}

function Section({
  kind,
  title,
  onAdd,
  onDragStart,
}: {
  kind: NodeKind;
  title: string;
  onAdd: (type: string) => void;
  onDragStart: (e: DragEvent, type: string) => void;
}) {
  const items = PALETTE.filter((p) => p.kind === kind);
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.type}
            type="button"
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            onClick={() => onAdd(item.type)}
            className={`flex min-h-[44px] cursor-grab items-center gap-2.5 rounded-xl border px-3 py-2 text-start text-sm font-medium transition active:cursor-grabbing ${
              kind === 'trigger'
                ? 'border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/20'
                : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20'
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              {item.icon}
            </span>
            <span className="leading-tight">{item.defaultName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function NodePalette({ open, onToggle, onAdd, onDragStart }: PaletteProps) {
  const { t } = useI18n();
  return (
    <div>
      {/* Mobile: toggle + horizontal chip row */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <span>{t.editor.palette}</span>
          <span aria-hidden>{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="list">
              {PALETTE.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => onAdd(item.type)}
                  className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium ${
                    item.kind === 'trigger'
                      ? 'border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-500/50 dark:bg-teal-500/15 dark:text-teal-100'
                      : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100'
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.defaultName}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.editor.paletteHint}</p>
          </div>
        )}
      </div>

      {/* Desktop: vertical palette beside the canvas */}
      <div className="hidden w-60 shrink-0 flex-col gap-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t.editor.palette}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t.editor.paletteHint}
          </p>
        </div>
        <Section kind="trigger" title={t.editor.triggers} onAdd={onAdd} onDragStart={onDragStart} />
        <Section kind="action" title={t.editor.actions} onAdd={onAdd} onDragStart={onDragStart} />
      </div>
    </div>
  );
}
