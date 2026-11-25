// Node catalogue for the visual editor (Phase 2).
// Covers every node type the seeded templates store, plus a manual
// trigger so an empty workflow can start from the canvas itself.
// Unknown stored types render as a generic node (see nodes.tsx),
// never as a crash — the editor must open any saved definition.
import type { WorkflowDefinition, WorkflowNode } from '../../lib/api';

export type NodeKind = 'trigger' | 'action' | 'unknown';

export interface PaletteItem {
  type: string;
  kind: NodeKind;
  icon: string;
  defaultName: string;
  defaultConfig: Record<string, unknown>;
}

export const PALETTE: PaletteItem[] = [
  {
    type: 'manual-trigger',
    kind: 'trigger',
    icon: '▶',
    defaultName: 'Manual Trigger',
    defaultConfig: {},
  },
  {
    type: 'webhook-trigger',
    kind: 'trigger',
    icon: '⌁',
    defaultName: 'Webhook Trigger',
    defaultConfig: { path: '/webhook', method: 'POST' },
  },
  {
    type: 'schedule-trigger',
    kind: 'trigger',
    icon: '◷',
    defaultName: 'Schedule Trigger',
    defaultConfig: { cron: '0 8 * * *' },
  },
  {
    type: 'telegram-trigger',
    kind: 'trigger',
    icon: '✈',
    defaultName: 'Telegram Trigger',
    defaultConfig: { chatId: '', keyword: '' },
  },
  {
    type: 'http-request',
    kind: 'action',
    icon: '↔',
    defaultName: 'HTTP Request',
    defaultConfig: { url: 'https://example.com/api', method: 'GET' },
  },
  {
    type: 'email-send',
    kind: 'action',
    icon: '✉',
    defaultName: 'Email',
    defaultConfig: { to: '', subject: '', body: '' },
  },
  {
    type: 'google-sheets-append',
    kind: 'action',
    icon: '▦',
    defaultName: 'Google Sheets Append Row',
    defaultConfig: { spreadsheetId: '', sheet: 'Sheet1', columns: ['message'] },
  },
  {
    type: 'discord-message',
    kind: 'action',
    icon: '💬',
    defaultName: 'Discord Message',
    defaultConfig: { webhookUrl: '', content: '' },
  },
];

export function paletteItemFor(type: string): PaletteItem | undefined {
  // The seeded template stores the sheets node as "google-sheets-append";
  // accept the shorter "sheets-append" alias too.
  if (type === 'sheets-append') return PALETTE.find((p) => p.type === 'google-sheets-append');
  return PALETTE.find((p) => p.type === type);
}

export function nodeKind(type: string): NodeKind {
  return paletteItemFor(type)?.kind ?? 'unknown';
}

export function nodeIcon(type: string): string {
  return paletteItemFor(type)?.icon ?? '?';
}

export function defaultNameFor(type: string): string {
  return paletteItemFor(type)?.defaultName ?? type;
}

/** Convert a stored definition into React Flow nodes/edges. Tolerant of
 *  missing or malformed fields — an empty or broken definition yields an
 *  empty canvas, never a crash. */
export function definitionToFlow(def: WorkflowDefinition | undefined): {
  nodes: import('./nodes').FlowNode[];
  edges: import('@xyflow/react').Edge[];
} {
  const nodes = Array.isArray(def?.nodes) ? def!.nodes : [];
  const edges = Array.isArray(def?.edges) ? def!.edges : [];
  const nodeIds = new Set<string>();
  const flowNodes = nodes
    .filter((n): n is WorkflowNode => !!n && typeof (n as WorkflowNode).id === 'string')
    .map((n) => {
      nodeIds.add(n.id);
      return {
        id: n.id,
        type: 'flowNode' as const,
        position: {
          x: typeof n.position?.x === 'number' ? n.position.x : 0,
          y: typeof n.position?.y === 'number' ? n.position.y : 0,
        },
        data: {
          label: typeof n.name === 'string' && n.name ? n.name : defaultNameFor(n.type ?? ''),
          nodeType: typeof n.type === 'string' ? n.type : 'unknown',
          config:
            n.config && typeof n.config === 'object' && !Array.isArray(n.config)
              ? (n.config as Record<string, unknown>)
              : {},
        },
      };
    });
  const flowEdges = edges
    .filter(
      (e): e is { id: string; source: string; target: string } =>
        !!e &&
        typeof (e as { id: string }).id === 'string' &&
        nodeIds.has((e as { source: string }).source) &&
        nodeIds.has((e as { target: string }).target),
    )
    .map((e) => ({ id: e.id, source: e.source, target: e.target }));
  return { nodes: flowNodes, edges: flowEdges };
}

/** Convert React Flow state back into the stored definition shape.
 *  Drops edges whose source/target no longer exists. */
export function flowToDefinition(
  nodes: import('./nodes').FlowNode[],
  edges: import('@xyflow/react').Edge[],
): WorkflowDefinition {
  const nodeIds = new Set(nodes.map((n) => n.id));
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      name: n.data.label,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      config: n.data.config,
    })),
    edges: edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}
