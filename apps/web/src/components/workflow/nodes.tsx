// Custom React Flow node: one card style per node kind.
// Triggers (manual / webhook / schedule / telegram) are teal,
// actions (HTTP / email / sheets / discord) are amber,
// unknown stored types fall back to a neutral slate card.
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { nodeIcon, nodeKind } from './nodeTypes';
import type { NodeKind } from './nodeTypes';

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  config: Record<string, unknown>;
}

export type FlowNode = Node<FlowNodeData, 'flowNode'>;

const kindStyles: Record<NodeKind, { card: string; chip: string }> = {
  trigger: {
    card:
      'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-950',
    chip: 'bg-teal-600 text-white dark:bg-teal-500',
  },
  action: {
    card:
      'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950',
    chip: 'bg-amber-500 text-white dark:bg-amber-500',
  },
  unknown: {
    card: 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800',
    chip: 'bg-slate-500 text-white',
  },
};

export function FlowNodeComponent({ data, selected }: NodeProps<FlowNode>) {
  const kind = nodeKind(data.nodeType);
  const styles = kindStyles[kind];
  return (
    <div
      className={`min-h-[56px] w-[200px] rounded-xl border-2 shadow-soft transition ${
        styles.card
      } ${
        selected
          ? 'ring-4 ring-brand-500/40 dark:ring-brand-400/40'
          : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-500 dark:!border-slate-900"
      />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span
          aria-hidden
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${styles.chip}`}
        >
          {nodeIcon(data.nodeType)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">
            {data.label}
          </span>
          <span className="block truncate text-xs leading-tight text-slate-500 dark:text-slate-400">
            {data.nodeType}
          </span>
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-500 dark:!border-slate-900"
      />
    </div>
  );
}

export const nodeTypes = { flowNode: FlowNodeComponent };
