import { Router, type Request, type Response } from "express";
import { VERSION } from "../config.js";
import { requireAuth } from "../lib/auth.js";
import type { Db } from "../lib/db.js";
import { asyncHandler } from "../lib/errors.js";

export function createSystemRouter(db: Db): Router {
  const router = Router();

  router.get(
    "/status",
    requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      let dbOk = false;
      try {
        db.prepare("SELECT 1").get();
        dbOk = true;
      } catch {
        dbOk = false;
      }
      res.json({
        api: "ok",
        db: dbOk ? "ok" : "error",
        uptimeSeconds: Math.floor(process.uptime()),
        version: VERSION,
      });
    }),
  );

  return router;
}
