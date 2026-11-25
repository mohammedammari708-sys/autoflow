import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import type { Db } from "../lib/db.js";
import { nowIso } from "../lib/db.js";
import { asyncHandler, notFound, validationError } from "../lib/errors.js";

export interface WorkflowRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  definition: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export function serializeWorkflow(row: WorkflowRow, withDefinition = true) {
  const base = {
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (!withDefinition) return base;
  return { ...base, definition: JSON.parse(row.definition) as unknown };
}

function validate<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw validationError(
      first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request body",
    );
  }
  return result.data;
}

const definitionSchema = z
  .object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  })
  .passthrough();

const createSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    description: z.string().max(1000).optional(),
  })
  .strict();

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    active: z.boolean().optional(),
    definition: definitionSchema.optional(),
  })
  .strict();

function getOwnedWorkflow(db: Db, userId: string, id: string): WorkflowRow {
  const row = db
    .prepare("SELECT * FROM workflows WHERE id = ? AND user_id = ?")
    .get(id, userId) as unknown as WorkflowRow | undefined;
  if (!row) throw notFound("Workflow not found");
  return row;
}

function insertVersion(db: Db, workflowId: string, definition: string, versionNumber: number): void {
  db.prepare(
    "INSERT INTO workflow_versions (id, workflow_id, version_number, definition, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(crypto.randomUUID(), workflowId, versionNumber, definition, nowIso());
}

export function createWorkflow(
  db: Db,
  userId: string,
  name: string,
  description: string,
  definition: unknown,
): WorkflowRow {
  const id = crypto.randomUUID();
  const now = nowIso();
  const definitionJson = JSON.stringify(definition);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      "INSERT INTO workflows (id, user_id, name, description, definition, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
    ).run(id, userId, name, description, definitionJson, now, now);
    insertVersion(db, id, definitionJson, 1);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return db.prepare("SELECT * FROM workflows WHERE id = ?").get(id) as unknown as WorkflowRow;
}

export function createWorkflowsRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/",
    asyncHandler(async (req: Request, res: Response) => {
      const rows = db
        .prepare("SELECT * FROM workflows WHERE user_id = ? ORDER BY updated_at DESC")
        .all(req.user!.id) as unknown as WorkflowRow[];
      res.json({ workflows: rows.map((r) => serializeWorkflow(r, false)) });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req: Request, res: Response) => {
      const body = validate(createSchema, req.body);
      const row = createWorkflow(
        db,
        req.user!.id,
        body.name,
        body.description ?? "",
        { nodes: [], edges: [] },
      );
      res.status(201).json({ workflow: serializeWorkflow(row) });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const row = getOwnedWorkflow(db, req.user!.id, String(req.params.id));
      res.json({ workflow: serializeWorkflow(row) });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const body = validate(updateSchema, req.body);
      const row = getOwnedWorkflow(db, req.user!.id, String(req.params.id));
      const now = nowIso();
      const next = {
        name: body.name ?? row.name,
        description: body.description ?? row.description,
        active: body.active === undefined ? row.active : body.active ? 1 : 0,
        definition: body.definition ? JSON.stringify(body.definition) : row.definition,
      };
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare(
          "UPDATE workflows SET name = ?, description = ?, active = ?, definition = ?, updated_at = ? WHERE id = ?",
        ).run(next.name, next.description, next.active, next.definition, now, row.id);
        if (body.definition) {
          const maxRow = db
            .prepare("SELECT MAX(version_number) AS m FROM workflow_versions WHERE workflow_id = ?")
            .get(row.id) as unknown as { m: number | null } | undefined;
          insertVersion(db, row.id, next.definition, (maxRow?.m ?? 0) + 1);
        }
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
      const updated = getOwnedWorkflow(db, req.user!.id, row.id);
      res.json({ workflow: serializeWorkflow(updated) });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const row = getOwnedWorkflow(db, req.user!.id, String(req.params.id));
      db.prepare("DELETE FROM workflows WHERE id = ?").run(row.id);
      res.status(204).send();
    }),
  );

  return router;
}
