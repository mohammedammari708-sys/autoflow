import { Router, type Request, type Response } from "express";
import { requireAuth } from "../lib/auth.js";
import type { Db } from "../lib/db.js";
import { asyncHandler } from "../lib/errors.js";

function count(db: Db, sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...(params as never[])) as unknown as { c: number } | undefined;
  return row?.c ?? 0;
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Dashboard stats — all real queries against the user's own data.
 * executionsByDay covers the last 7 days (UTC dates); recentActivity
 * is the latest 5 events derived from the user's workflows and
 * executions.
 */
export function createDashboardRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/stats",
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;

      const totalWorkflows = count(db, "SELECT COUNT(*) AS c FROM workflows WHERE user_id = ?", userId);
      const activeWorkflows = count(
        db,
        "SELECT COUNT(*) AS c FROM workflows WHERE user_id = ? AND active = 1",
        userId,
      );
      const totalExecutions = count(
        db,
        "SELECT COUNT(*) AS c FROM workflow_executions WHERE user_id = ?",
        userId,
      );
      const successfulExecutions = count(
        db,
        "SELECT COUNT(*) AS c FROM workflow_executions WHERE user_id = ? AND status = 'success'",
        userId,
      );
      const failedExecutions = count(
        db,
        "SELECT COUNT(*) AS c FROM workflow_executions WHERE user_id = ? AND status = 'failed'",
        userId,
      );

      // executionsByDay: last 7 days, oldest first.
      const since = `${isoDateDaysAgo(6)}T00:00:00.000Z`;
      const dayRows = db
        .prepare(
          `SELECT substr(started_at, 1, 10) AS day, status, COUNT(*) AS c
           FROM workflow_executions
           WHERE user_id = ? AND started_at >= ?
           GROUP BY day, status`,
        )
        .all(userId, since) as unknown as Array<{ day: string; status: string; c: number }>;
      const executionsByDay = [];
      for (let i = 6; i >= 0; i--) {
        const date = isoDateDaysAgo(i);
        const success = dayRows.find((r) => r.day === date && r.status === "success")?.c ?? 0;
        const failed = dayRows.find((r) => r.day === date && r.status === "failed")?.c ?? 0;
        executionsByDay.push({ date, success, failed });
      }

      // recentActivity: latest 5 of (workflow created) + (execution run).
      const activityRows = db
        .prepare(
          `SELECT id, 'workflow' AS kind, name AS title, 'Workflow created' AS detail, created_at AS created_at
           FROM workflows WHERE user_id = ?
           UNION ALL
           SELECT e.id, 'execution' AS kind, w.name AS title,
                  ('Execution ' || e.status) AS detail, e.started_at AS created_at
           FROM workflow_executions e
           JOIN workflows w ON w.id = e.workflow_id
           WHERE e.user_id = ?
           ORDER BY created_at DESC
           LIMIT 5`,
        )
        .all(userId, userId) as unknown as Array<{
        id: string;
        kind: string;
        title: string;
        detail: string;
        created_at: string;
      }>;
      const recentActivity = activityRows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        detail: r.detail,
        createdAt: r.created_at,
      }));

      res.json({
        totalWorkflows,
        activeWorkflows,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        executionsByDay,
        recentActivity,
      });
    }),
  );

  return router;
}
