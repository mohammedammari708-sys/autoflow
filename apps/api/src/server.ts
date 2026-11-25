import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import type { Server } from "node:http";
import { PORT, VERSION, WEB_ORIGIN } from "./config.js";
import { requireAuth } from "./lib/auth.js";
import { closeDb, initDb, type Db } from "./lib/db.js";
import { errorHandler, notFound } from "./lib/errors.js";
import { createAuthRouter } from "./routes/auth.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createExecutionsRouter } from "./routes/executions.js";
import { createIntegrationsRouter } from "./routes/integrations.js";
import { createSystemRouter } from "./routes/system.js";
import { createTemplatesRouter } from "./routes/templates.js";
import { createWorkflowsRouter } from "./routes/workflows.js";

export function createApp(db: Db): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: WEB_ORIGIN,
      credentials: true,
    }),
  );
  // JSON body limit 1 MB (CONTRACT.md).
  app.use(express.json({ limit: "1mb" }));

  const health = (_req: Request, res: Response) => {
    let dbOk = false;
    try {
      db.prepare("SELECT 1").get();
      dbOk = true;
    } catch {
      dbOk = false;
    }
    if (!dbOk) {
      res.status(503).json({ error: { code: "INTERNAL", message: "Database unavailable" } });
      return;
    }
    res.json({ status: "ok", db: "ok", version: VERSION });
  };
  // Health is public at both /health and /api/health.
  app.get("/health", health);

  const api = express.Router();
  api.get("/health", health);
  api.use("/auth", createAuthRouter(db));
  api.use("/dashboard", createDashboardRouter(db));
  api.use("/workflows", createWorkflowsRouter(db));
  api.use("/templates", createTemplatesRouter(db));
  api.use("/executions", createExecutionsRouter(db));
  api.use("/integrations", createIntegrationsRouter(db));
  api.use("/system", createSystemRouter(db));
  // Any other /api path is a JSON 404, never an HTML page.
  api.use((_req, _res, next) => next(notFound("Route not found")));
  app.use("/api", api);

  // Unknown non-API routes.
  app.use((_req, _res, next) => next(notFound("Route not found")));
  app.use(errorHandler);

  return app;
}

export interface RunningServer {
  app: Express;
  server: Server;
  port: number;
  db: Db;
  close: () => Promise<void>;
}

export function startServer(options?: { port?: number; dbPath?: string }): RunningServer {
  const db = options?.dbPath ? initDb(options.dbPath) : initDb();
  const app = createApp(db);
  const port = options?.port ?? PORT;
  const server = app.listen(port, () => {
    const addr = server.address();
    const actual = typeof addr === "object" && addr ? addr.port : port;
    console.log(`[AutoFlow] API listening on http://localhost:${actual} (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
  });
  return {
    app,
    server,
    port,
    db,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          // closeDb() closes the cached singleton (if this is it);
          // db.close() closes a temp/test database. Each is safe to
          // call on an already-closed handle.
          closeDb();
          try {
            db.close();
          } catch {
            // Already closed by closeDb().
          }
          resolve();
        });
      }),
  };
}

// Re-export for tests that need the auth guard.
export { requireAuth };
