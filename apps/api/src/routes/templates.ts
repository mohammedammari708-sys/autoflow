import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import type { Db } from "../lib/db.js";
import { asyncHandler, notFound, validationError } from "../lib/errors.js";
import { createWorkflow, serializeWorkflow, type WorkflowRow } from "./workflows.js";

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  category: string;
  definition: string;
  created_at: string;
}

function serializeTemplate(row: TemplateRow, withDefinition = false) {
  const base = {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    createdAt: row.created_at,
  };
  if (!withDefinition) return base;
  return { ...base, definition: JSON.parse(row.definition) as unknown };
}

const importSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export function createTemplatesRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      const rows = db
        .prepare("SELECT * FROM templates ORDER BY name ASC")
        .all() as unknown as TemplateRow[];
      res.json({ templates: rows.map((r) => serializeTemplate(r)) });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const row = db
        .prepare("SELECT * FROM templates WHERE id = ?")
        .get(String(req.params.id)) as unknown as TemplateRow | undefined;
      if (!row) throw notFound("Template not found");
      res.json({ template: serializeTemplate(row, true) });
    }),
  );

  router.post(
    "/:id/import",
    asyncHandler(async (req: Request, res: Response) => {
      const result = importSchema.safeParse(req.body ?? {});
      if (!result.success) {
        const first = result.error.issues[0];
        throw validationError(
          first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request body",
        );
      }
      const row = db
        .prepare("SELECT * FROM templates WHERE id = ?")
        .get(String(req.params.id)) as unknown as TemplateRow | undefined;
      if (!row) throw notFound("Template not found");
      const definition = JSON.parse(row.definition) as unknown;
      const workflow = createWorkflow(
        db,
        req.user!.id,
        result.data.name ?? row.name,
        row.description,
        definition,
      );
      // Reuse the workflow serializer via a fresh read.
      const full = db
        .prepare("SELECT * FROM workflows WHERE id = ?")
        .get(workflow.id) as unknown as WorkflowRow;
      res.status(201).json({ workflow: serializeWorkflow(full) });
    }),
  );

  return router;
}
