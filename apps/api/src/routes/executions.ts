import { Router, type Request, type Response } from "express";
import { requireAuth } from "../lib/auth.js";
import type { Db } from "../lib/db.js";
import { asyncHandler, notFound } from "../lib/errors.js";

interface ExecutionRow {
  id: string;
  workflow_id: string;
  workflow_name: string;
  user_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

interface LogRow {
  id: string;
  node_id: string | null;
  level: string;
  message: string;
  data: string | null;
  created_at: string;
}

function serializeExecution(r: ExecutionRow) {
  return {
    id: r.id,
    workflowId: r.workflow_id,
    workflowName: r.workflow_name,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    error: r.error,
  };
}

/**
 * Execution history. Real query, real (empty in Phase 1) data —
 * executions are only created by the execution engine, which arrives
 * in Phase 3.
 */
export function createExecutionsRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/",
    asyncHandler(async (req: Request, res: Response) => {
      const rows = db
        .prepare(
          `SELECT e.*, w.name AS workflow_name
           FROM workflow_executions e
           JOIN workflows w ON w.id = e.workflow_id
           WHERE e.user_id = ?
           ORDER BY e.started_at DESC`,
        )
        .all(req.user!.id) as unknown as ExecutionRow[];
      res.json({
        executions: rows.map((r) => serializeExecution(r)),
      });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const row = db
        .prepare(
          `SELECT e.*, w.name AS workflow_name
           FROM workflow_executions e
           JOIN workflows w ON w.id = e.workflow_id
           WHERE e.id = ? AND e.user_id = ?`,
        )
        .get(String(req.params.id), req.user!.id) as unknown as ExecutionRow | undefined;
      if (!row) throw notFound("Execution not found");
      const logs = db
        .prepare(
          `SELECT * FROM execution_logs
           WHERE execution_id = ?
           ORDER BY created_at ASC, rowid ASC`,
        )
        .all(row.id) as unknown as LogRow[];
      res.json({
        execution: serializeExecution(row),
        logs: logs.map((l) => ({
          id: l.id,
          nodeId: l.node_id,
          level: l.level,
          message: l.message,
          data: l.data ? (JSON.parse(l.data) as unknown) : null,
          createdAt: l.created_at,
        })),
      });
    }),
  );

  return router;
}
