/**
 * Phase 3 execution engine — BACKEND only.
 *
 * runWorkflow() walks a workflow definition from its trigger node,
 * executes each reachable node once (sequential, edge order), and
 * records one execution_logs row per node plus a workflow_executions row.
 *
 * Master rule (binding): NEVER fake success. Integrations are all
 * "not_configured" until Phase 4 — a node needing one FAILS honestly
 * with a clear per-node "not configured" error recorded in the logs.
 * Never log secrets/tokens, never log full HTTP bodies (truncated to
 * ~500 chars), never log request headers.
 */
import crypto from "node:crypto";
import type { Db } from "./db.js";
import { nowIso } from "./db.js";

export const MAX_NODES_PER_RUN = 50;
export const MAX_TOTAL_MS = 30_000;
export const PER_NODE_TIMEOUT_MS = 15_000;

const TRIGGER_TYPES = new Set([
  "manual-trigger",
  "webhook-trigger",
  "schedule-trigger",
  "telegram-trigger",
]);

/** Display name + honest failure message for each unconfigured integration. */
const NOT_CONFIGURED: Record<string, string> = {
  "telegram-trigger": "Telegram is not configured — connect it in Integrations (Phase 4)",
  "email-send": "Email is not configured — connect it in Integrations (Phase 4)",
  "google-sheets-append": "Google Sheets is not configured — connect it in Integrations (Phase 4)",
  "sheets-append": "Google Sheets is not configured — connect it in Integrations (Phase 4)",
  "discord-message": "Discord is not configured — connect it in Integrations (Phase 4)",
};

export interface EngineNode {
  id: string;
  type: string;
  name?: string;
  config?: Record<string, unknown>;
}

export interface EngineDefinition {
  nodes: EngineNode[];
  edges: Array<{ id: string; source: string; target: string }>;
}

export interface NodeResult {
  nodeId: string;
  nodeType: string;
  name: string;
  status: "success" | "failed";
  error?: string;
}

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

export interface RunResult {
  execution: ExecutionSummary;
  nodes: NodeResult[];
}

interface NodeOutcome {
  message: string;
  /** Safe summary data for the log row — never secrets, never full bodies. */
  data?: Record<string, unknown>;
}

function insertLog(
  db: Db,
  executionId: string,
  nodeId: string | null,
  level: "info" | "error",
  message: string,
  data?: Record<string, unknown>,
): void {
  db.prepare(
    "INSERT INTO execution_logs (id, execution_id, node_id, level, message, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    crypto.randomUUID(),
    executionId,
    nodeId,
    level,
    message,
    data ? JSON.stringify(data) : null,
    nowIso(),
  );
}

function finishExecution(
  db: Db,
  executionId: string,
  status: "success" | "failed",
  error: string | null,
): ExecutionSummary {
  const finishedAt = nowIso();
  db.prepare(
    "UPDATE workflow_executions SET status = ?, finished_at = ?, error = ? WHERE id = ?",
  ).run(status, finishedAt, error, executionId);
  const row = db
    .prepare("SELECT * FROM workflow_executions WHERE id = ?")
    .get(executionId) as unknown as {
    id: string;
    workflow_id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    error: string | null;
  };
  return {
    id: row.id,
    workflowId: row.workflow_id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
  };
}

/** Execute one node. Throws an Error with a user-facing message on failure. */
async function executeNode(node: EngineNode): Promise<NodeOutcome> {
  const config =
    node.config && typeof node.config === "object" && !Array.isArray(node.config)
      ? (node.config as Record<string, unknown>)
      : {};
  const type = node.type;

  switch (type) {
    case "manual-trigger":
      return { message: "manual run started", data: { status: "success", input: "empty" } };

    case "webhook-trigger":
      return {
        message: "manual run: webhook trigger started with empty input",
        data: { status: "success", input: "empty" },
      };

    case "schedule-trigger":
      return {
        message: "manual run: schedule ignored, started immediately",
        data: { status: "success" },
      };

    case "telegram-trigger":
    case "email-send":
    case "google-sheets-append":
    case "sheets-append":
    case "discord-message":
      throw new Error(NOT_CONFIGURED[type]);

    case "http-request": {
      const urlRaw = config.url;
      if (typeof urlRaw !== "string" || !urlRaw.trim()) {
        throw new Error("HTTP Request node has no URL configured");
      }
      let url: URL;
      try {
        url = new URL(urlRaw.trim());
      } catch {
        throw new Error(`HTTP Request URL is invalid: ${urlRaw.trim()}`);
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(
          `HTTP Request URL must use http:// or https:// (got ${url.protocol})`,
        );
      }
      const method =
        typeof config.method === "string" && config.method.trim()
          ? config.method.trim().toUpperCase()
          : "GET";
      const headers: Record<string, string> = {};
      if (config.headers && typeof config.headers === "object" && !Array.isArray(config.headers)) {
        for (const [k, v] of Object.entries(config.headers as Record<string, unknown>)) {
          if (typeof v === "string") headers[k] = v;
        }
      }
      let body: string | undefined;
      if (config.body !== undefined && config.body !== null && method !== "GET" && method !== "HEAD") {
        body = typeof config.body === "string" ? config.body : JSON.stringify(config.body);
        if (!headers["Content-Type"] && !headers["content-type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
      let res: Response;
      try {
        res = await fetch(url.toString(), {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(PER_NODE_TIMEOUT_MS),
        });
      } catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
          throw new Error(`HTTP Request timed out after ${PER_NODE_TIMEOUT_MS / 1000}s`);
        }
        throw new Error(
          `HTTP Request failed: ${err instanceof Error ? err.message : "network error"}`,
        );
      }
      const text = await res.text().catch(() => "");
      const preview = text.slice(0, 500);
      if (!res.ok) {
        throw new Error(
          `HTTP Request failed with status ${res.status}${preview ? `: ${preview}` : ""}`,
        );
      }
      return {
        message: `HTTP ${method} ${url.host}${url.pathname} → ${res.status}`,
        data: { status: "success", httpStatus: res.status, responsePreview: preview },
      };
    }

    default:
      throw new Error(`Unknown node type '${type}'`);
  }
}

function parseDefinition(raw: string): EngineDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Workflow definition is not valid JSON");
  }
  const nodes = (parsed as { nodes?: unknown })?.nodes;
  const edges = (parsed as { edges?: unknown })?.edges;
  if (!Array.isArray(nodes)) throw new Error("Workflow definition has no nodes array");
  if (!Array.isArray(edges)) throw new Error("Workflow definition has no edges array");
  return {
    nodes: nodes.filter(
      (n): n is EngineNode =>
        !!n && typeof (n as EngineNode).id === "string" && typeof (n as EngineNode).type === "string",
    ),
    edges: edges.filter(
      (e): e is EngineDefinition["edges"][number] =>
        !!e &&
        typeof (e as { source: string }).source === "string" &&
        typeof (e as { target: string }).target === "string",
    ),
  };
}

export async function runWorkflow(
  db: Db,
  userId: string,
  workflow: { id: string; definition: string },
): Promise<RunResult> {
  const startedAt = nowIso();
  const executionId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO workflow_executions (id, workflow_id, user_id, status, started_at, finished_at, error) VALUES (?, ?, ?, 'running', ?, NULL, NULL)",
  ).run(executionId, workflow.id, userId, startedAt);
  const deadline = Date.now() + MAX_TOTAL_MS;

  const fail = (message: string, nodeResults: NodeResult[]): RunResult => {
    const execution = finishExecution(db, executionId, "failed", message);
    return { execution, nodes: nodeResults };
  };

  let definition: EngineDefinition;
  try {
    definition = parseDefinition(workflow.definition);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid workflow definition";
    insertLog(db, executionId, null, "error", message, { status: "failed" });
    return fail(message, []);
  }

  const nodeResults: NodeResult[] = [];

  if (definition.nodes.length === 0) {
    const message = "Workflow has no nodes — add a trigger node to run it";
    insertLog(db, executionId, null, "error", message, { status: "failed" });
    return fail(message, []);
  }

  // Find the trigger: first node of a trigger type, else the node with no
  // incoming edges. If neither exists (e.g. a pure cycle), fail honestly.
  const incoming = new Set(definition.edges.map((e) => e.target));
  const trigger =
    definition.nodes.find((n) => TRIGGER_TYPES.has(n.type)) ??
    definition.nodes.find((n) => !incoming.has(n.id));
  if (!trigger) {
    const message = "Workflow has no trigger node — add a trigger node to run it";
    insertLog(db, executionId, null, "error", message, { status: "failed" });
    return fail(message, []);
  }

  // Walk edges in order from the trigger; visit each reachable node once
  // (cycles stop at already-visited nodes). Sequential only.
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  for (const e of definition.edges) {
    const list = outgoing.get(e.source) ?? [];
    list.push(e.target);
    outgoing.set(e.source, list);
  }
  const order: EngineNode[] = [];
  const visited = new Set<string>();
  const queue: EngineNode[] = [trigger];
  visited.add(trigger.id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const targetId of outgoing.get(current.id) ?? []) {
      if (visited.has(targetId)) continue;
      const target = byId.get(targetId);
      if (!target) continue;
      visited.add(targetId);
      queue.push(target);
    }
  }

  if (order.length > MAX_NODES_PER_RUN) {
    const message = `Workflow has more than ${MAX_NODES_PER_RUN} nodes — run aborted`;
    insertLog(db, executionId, null, "error", message, { status: "failed" });
    return fail(message, []);
  }

  for (const node of order) {
    if (Date.now() > deadline) {
      const message = "Execution timed out after 30s";
      insertLog(db, executionId, node.id, "error", message, { status: "failed" });
      nodeResults.push({
        nodeId: node.id,
        nodeType: node.type,
        name: node.name ?? node.type,
        status: "failed",
        error: message,
      });
      return fail(message, nodeResults);
    }
    try {
      const outcome = await executeNode(node);
      insertLog(db, executionId, node.id, "info", outcome.message, outcome.data ?? { status: "success" });
      nodeResults.push({
        nodeId: node.id,
        nodeType: node.type,
        name: node.name ?? node.type,
        status: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Node failed";
      insertLog(db, executionId, node.id, "error", message, { status: "failed" });
      nodeResults.push({
        nodeId: node.id,
        nodeType: node.type,
        name: node.name ?? node.type,
        status: "failed",
        error: message,
      });
      return fail(message, nodeResults);
    }
  }

  const execution = finishExecution(db, executionId, "success", null);
  return { execution, nodes: nodeResults };
}
