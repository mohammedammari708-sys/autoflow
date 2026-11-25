import { Router, type Request, type Response } from "express";
import { requireAuth } from "../lib/auth.js";
import type { Db } from "../lib/db.js";
import { asyncHandler } from "../lib/errors.js";

interface IntegrationRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  auth_type: string;
  status: string;
}

/**
 * Integrations catalog (seeded). Every integration is honestly
 * `not_configured` in Phase 1 — connecting one arrives in Phase 4.
 */
export function createIntegrationsRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      const rows = db
        .prepare("SELECT * FROM integrations ORDER BY name ASC")
        .all() as unknown as IntegrationRow[];
      res.json({
        integrations: rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          category: r.category,
          description: r.description,
          status: r.status,
          authType: r.auth_type,
        })),
      });
    }),
  );

  return router;
}
