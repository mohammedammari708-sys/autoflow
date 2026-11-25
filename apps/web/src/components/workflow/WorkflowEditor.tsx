// Workflow Studio — the visual drag-and-drop editor (Phase 2).
// Built on @xyflow/react. Loads the stored definition, lets the user add /
// move / connect / configure / delete nodes, and saves the definition back
// with PATCH /api/workflows/:id. It never claims a workflow runs:
// execution is Phase 3, so the Run button is disabled with an honest note.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { workflowsApi, ApiError } from '../../lib/api';
import type { Workflow } from '../../lib/api';
import { useI18n } from '../../i18n';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { nodeTypes } from './nodes';
import type { FlowNode } from './nodes';
import { definitionToFlow, flowToDefinition, paletteItemFor } from './nodeTypes';

function snapshot(name: string, nodes: FlowNode[], edges: Edge[]): string {
  return JSON.stringify({ name, def: flowToDefinition(nodes, edges) });
}

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

function EditorInner({
  workflow,
  onSaved,
}: {
  workflow: Workflow;
  onSaved: (w: Workflow) => void;
}) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const toast = useToast();
  const rf = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  const initial = useMemo(
    () => definitionToFlow(workflow.definition),
    // Load once on mount; later saves flow up via onSaved, not back in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [name, setName] = useState(workflow.name);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // Panel visibility is separate from canvas selection: tapping a palette
  // chip adds + selects a node but must NOT pop the bottom sheet over the
  // toolbar (the user needs to reach Save). The panel opens only when the
  // user taps a node/edge on the canvas itself.
  const [panelOpen, setPanelOpen] = useState(false);
  // Derive the selected node/edge from live canvas state so the config
  // panel always shows current values while editing.
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(snapshot(workflow.name, initial.nodes, initial.edges));

  const dirty = snapshot(name, nodes, edges) !== savedRef.current;

  // Unsaved-changes guard: browser-level (beforeunload). An in-app
  // navigation guard is not possible here — the app uses BrowserRouter,
  // and useBlocker requires a data router.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const addNodeAt = useCallback(
    (type: string, position: { x: number; y: number }) => {
      const item = paletteItemFor(type);
      if (!item) return;
      const id = crypto.randomUUID();
      const node: FlowNode = {
        id,
        type: 'flowNode',
        position,
        selected: true,
        data: {
          label: item.defaultName,
          nodeType: item.type,
          config: { ...item.defaultConfig },
        },
      };
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), node]);
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
      setPanelOpen(false);
    },
    [setNodes, setEdges],
  );

  const addNodeAtCenter = useCallback(
    (type: string) => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Cascade successive adds so they don't land exactly on top of each other.
      const step = 32;
      const offset = (nodes.length % 6) * step;
      const position = rf.screenToFlowPosition({
        x: rect.left + rect.width / 2 + offset,
        y: rect.top + rect.height / 2 + offset,
      });
      addNodeAt(type, position);
    },
    [rf, addNodeAt, nodes.length],
  );

  const onDragStart = useCallback((e: DragEvent, type: string) => {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type) return;
      addNodeAt(type, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [rf, addNodeAt],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, id: crypto.randomUUID() }, eds),
      );
    },
    [setEdges],
  );

  const updateNodeData = useCallback(
    (id: string, patch: Partial<FlowNode['data']>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [setNodes],
  );

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      const id = selectedNodeId;
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges]);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.push(t.editor.invalidDefinition, 'error');
      return;
    }
    const def = flowToDefinition(nodes, edges);
    if (!Array.isArray(def.nodes) || !Array.isArray(def.edges)) {
      toast.push(t.editor.invalidDefinition, 'error');
      return;
    }
    setSaving(true);
    try {
      const { workflow: w } = await workflowsApi.update(workflow.id, {
        name: trimmed,
        definition: def,
      });
      savedRef.current = snapshot(trimmed, nodes, edges);
      onSaved(w);
      toast.push(t.editor.saved, 'success');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : t.editor.saveFailed, 'error');
    } finally {
      setSaving(false);
    }
  }, [name, nodes, edges, workflow.id, onSaved, toast, t]);

  return (
    <div className="flex flex-col gap-3">
      {/* Editor toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={t.editor.renameHint}
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 text-base font-semibold text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:max-w-xs"
        />
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {nodes.length} {t.editor.nodesCount} · {edges.length} {t.editor.edgesCount}
        </span>
        {dirty && <Badge tone="amber">{t.editor.unsaved}</Badge>}
        <span className="ms-auto flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!selectedNodeId && !selectedEdgeId}
            onClick={deleteSelected}
            className="min-h-[44px]"
          >
            {t.editor.deleteSelected}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled
            title={t.editor.runNote}
            className="min-h-[44px]"
          >
            ▶ {t.editor.runDisabled}
          </Button>
          <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()} className="min-h-[44px]">
            {t.editor.save}
          </Button>
        </span>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <NodePalette
          open={paletteOpen}
          onToggle={() => setPaletteOpen((o) => !o)}
          onAdd={addNodeAtCenter}
          onDragStart={onDragStart}
        />

        <div
          ref={wrapperRef}
          className="relative h-[60vh] min-h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900 md:h-[70vh] md:flex-1"
        >
          <ReactFlow
            style={{ width: '100%', height: '100%' }}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={({ nodes: selNodes, edges: selEdges }) => {
              setSelectedNodeId(selNodes[0]?.id ?? null);
              setSelectedEdgeId(selEdges[0]?.id ?? null);
              setPanelOpen(!!(selNodes[0] || selEdges[0]));
            }}
            nodeTypes={nodeTypes}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            forceColorMode={theme}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{
              type: 'smoothstep',
              style: { stroke: '#94a3b8', strokeWidth: 2 },
            }}
            proOptions={{ hideAttribution: false }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
            {isDesktop && <MiniMap pannable zoomable />}
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-center shadow-lift dark:border-slate-700 dark:bg-slate-900/90">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t.editor.emptyCanvas}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {t.editor.emptyCanvasHint}
                </p>
              </div>
            </div>
          )}

          <NodeConfigPanel
            open={panelOpen}
            node={selectedNode}
            edge={selectedNode ? null : selectedEdge}
            nodes={nodes}
            onRename={(id, label) => updateNodeData(id, { label })}
            onConfigValue={(id, key, value) =>
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === id
                    ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
                    : n,
                ),
              )
            }
            onConfigDelete={(id, key) =>
              setNodes((nds) =>
                nds.map((n) => {
                  if (n.id !== id) return n;
                  const config = { ...n.data.config };
                  delete config[key];
                  return { ...n, data: { ...n.data, config } };
                }),
              )
            }
            onConfigAdd={(id, key) =>
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === id
                    ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: '' } } }
                    : n,
                ),
              )
            }
            onDeleteNode={(id) => {
              setNodes((nds) => nds.filter((n) => n.id !== id));
              setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
              setSelectedNodeId(null);
            }}
            onDeleteEdge={(id) => {
              setEdges((eds) => eds.filter((e) => e.id !== id));
              setSelectedEdgeId(null);
            }}
            onClose={() => {
              setPanelOpen(false);
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }}
          />
        </div>
      </div>

      <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {t.editor.runNote}
      </p>
    </div>
  );
}

export function WorkflowEditor({
  workflow,
  onSaved,
}: {
  workflow: Workflow;
  onSaved: (w: Workflow) => void;
}) {
  return (
    <ReactFlowProvider>
      <EditorInner workflow={workflow} onSaved={onSaved} />
    </ReactFlowProvider>
  );
}
