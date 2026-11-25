# AutoFlow API Contract v1 (Phase 1)

Base URL (dev): `http://localhost:4000/api`. The web app proxies `/api` to it
in development, so the frontend uses relative `/api/...` paths with
`credentials: "include"` on every request.

Auth: JWT in an **httpOnly cookie** named `autoflow_token`
(SameSite=Lax, 7-day expiry). No token is ever stored in localStorage.
Every endpoint except `/health` and the auth entry points requires the
cookie. All list/detail endpoints are scoped to the logged-in user
(`WHERE user_id = ?` on every query).

Errors are always JSON: `{ "error": { "code": "VALIDATION_ERROR" | "UNAUTHORIZED" | "NOT_FOUND" | "RATE_LIMITED" | "INTERNAL", "message": "..." } }`.

## Endpoints

| Method | Path | Auth | Body / Notes | Success |
|---|---|---|---|---|
| GET | `/health` | no | — | 200 `{ "status": "ok", "db": "ok", "version": "0.1.0" }` |
| POST | `/auth/register` | no | `{ "name", "email", "password" }` (password ≥ 8 chars; zod-validated) | 201 `{ "user": { "id", "name", "email", "createdAt" } }`, sets cookie |
| POST | `/auth/login` | no | `{ "email", "password" }` | 200 `{ "user": {...} }`, sets cookie |
| POST | `/auth/logout` | yes | — | 200 `{ "ok": true }`, clears cookie |
| GET | `/auth/me` | yes | — | 200 `{ "user": {...} }` |
| PATCH | `/auth/profile` | yes | `{ "name" }` | 200 `{ "user": {...} }` |
| POST | `/auth/forgot-password` | no | `{ "email" }`. Always 200 (no user enumeration). In dev (`NODE_ENV !== "production"`) the response also includes `devResetToken` and `devResetLink`, clearly dev-only, because SMTP is not configured. | 200 `{ "message": "If an account exists, a reset link was sent." }` |
| POST | `/auth/reset-password` | no | `{ "token", "newPassword" }` (≥ 8 chars). Token is single-use, 1-hour expiry. | 200 `{ "ok": true }` |
| GET | `/dashboard/stats` | yes | — | 200 `{ "totalWorkflows", "activeWorkflows", "totalExecutions", "successfulExecutions", "failedExecutions", "executionsByDay": [{ "date", "success", "failed" }], "recentActivity": [{ "id", "kind", "title", "detail", "createdAt" }] }` |
| GET | `/workflows` | yes | — | 200 `{ "workflows": [{ "id", "name", "description", "active", "createdAt", "updatedAt" }] }` |
| POST | `/workflows` | yes | `{ "name", "description"? }`. Creates a draft with an empty definition `{ "nodes": [], "edges": [] }`. | 201 `{ "workflow": {...full, incl. "definition"} }` |
| GET | `/workflows/:id` | yes | Owner only (404 if not yours) | 200 `{ "workflow": {...} }` |
| PATCH | `/workflows/:id` | yes | `{ "name"?, "description"?, "active"?, "definition"? }` (definition must be an object with `nodes`/`edges` arrays if provided) | 200 `{ "workflow": {...} }` |
| DELETE | `/workflows/:id` | yes | — | 204, no body |
| GET | `/templates` | yes | — | 200 `{ "templates": [{ "id", "name", "description", "category", "createdAt" }] }` |
| GET | `/templates/:id` | yes | — | 200 `{ "template": { ..., "definition": {...} } }` |
| POST | `/templates/:id/import` | yes | `{ "name"? }` — creates a real workflow from the template definition | 201 `{ "workflow": {...} }` |
| POST | `/workflows/:id/run` | yes | Owner only (404 if not yours). Runs the workflow synchronously (bounded ~30s) and returns the execution plus a per-node summary — no polling needed. | 200 `{ "execution": { "id", "workflowId", "status": "running" \| "success" \| "failed", "startedAt", "finishedAt", "error" }, "nodes": [{ "nodeId", "nodeType", "name", "status": "success" \| "failed", "error"? }] }` |
| GET | `/executions` | yes | — | 200 `{ "executions": [] }` in Phase 1 (real, empty) |
| GET | `/executions/:id` | yes | Owner only (404 if not yours) | 200 `{ "execution": {...}, "logs": [{ "id", "nodeId", "level": "info" \| "error", "message", "data", "createdAt" }] }` (logs in execution order) |
| GET | `/integrations` | yes | — | 200 `{ "integrations": [{ "id", "slug", "name", "category", "description", "status": "not_configured", "authType" }] }` |
| GET | `/system/status` | yes | — | 200 `{ "api": "ok", "db": "ok", "uptimeSeconds", "version": "0.1.0" }` |

## Database tables (SQLite, `apps/api/data/autoflow.db`)

`users` (id TEXT PK, name, email UNIQUE, password_hash, created_at, updated_at),
`profiles` (user_id FK → users, avatar_url, timezone, language, theme, …),
`workflows` (id TEXT PK, user_id FK, name, description, definition TEXT JSON,
active INTEGER 0/1, created_at, updated_at),
`workflow_versions` (id, workflow_id FK, version_number, definition TEXT JSON, created_at),
`workflow_executions` (id, workflow_id FK, user_id FK, status, started_at, finished_at, error TEXT),
`execution_logs` (id, execution_id FK, node_id, level, message, data TEXT JSON, created_at),
`integrations` (id, slug UNIQUE, name, category, description, auth_type, status),
`credentials` (id, user_id FK, integration_slug, name, encrypted_value TEXT,
encryption_iv TEXT, created_at) — values encrypted with AES-256-GCM using
`ENCRYPTION_KEY` (32-byte hex) from env; never stored or logged in plaintext,
`templates` (id, name, description, category, definition TEXT JSON, created_at),
`subscriptions` (id, user_id FK, plan TEXT, status, current_period_end, created_at),
`usage_records` (id, user_id FK, metric TEXT, quantity, period_start, period_end),
`notifications` (id, user_id FK, type, title, body, read INTEGER, created_at),
`password_resets` (id, user_id FK, token_hash, expires_at, used INTEGER).

IDs are `crypto.randomUUID()`. Timestamps are ISO strings. Foreign keys ON,
with indexes on `workflows.user_id`, `workflow_executions.workflow_id`,
`execution_logs.execution_id`, `credentials.user_id`.

## Security rules (binding)

- bcryptjs cost 10 for password hashing; never log passwords or tokens.
- JWT HS256, 7-day expiry, secret from `JWT_SECRET` env. In production the
  server refuses to start without it; in dev an ephemeral random secret is
  generated per run with a loud console warning.
- `ENCRYPTION_KEY` (32-byte hex) same rule: required in production,
  ephemeral dev key with warning otherwise.
- Rate limiting on auth endpoints (login/register/forgot-password):
  10 requests / 15 min per IP in production; in dev the limit is higher
  (100 / 15 min) so tests don't trip it — document this.
- Helmet headers, CORS restricted to the local frontend origin
  (`http://localhost:5173`, configurable via `WEB_ORIGIN`), JSON body limit 1 MB.
- Validation with zod on every mutating endpoint; unknown fields rejected.
- No secrets in frontend code or in git: `.env` is gitignored everywhere.

## Seeded templates (real workflow JSON, execution arrives in Phase 3)

Execution engine (Phase 3): `POST /workflows/:id/run` walks the definition
from its trigger node (first trigger-type node, else the node with no
incoming edges) in edge order, visiting each reachable node once
(sequential; cycles stop at already-visited nodes; max 50 nodes per run,
max ~30s total, 15s per-node timeout for HTTP). One `execution_logs` row
per node; a node failure stops the walk and marks the execution `failed`.
**Honest failure (binding):** integrations are all `not_configured` until
Phase 4 — a node needing one (Telegram, Email, Google Sheets, Discord)
FAILS with e.g. `"Telegram is not configured — connect it in Integrations
(Phase 4)"`, recorded in the logs; success is never faked. Only
`http-request` really executes (real `fetch`, http/https only, non-2xx is
a node failure). Manual runs start triggers with empty input
(webhook/schedule triggers log that explicitly). Logs never contain
secrets, request headers, or full response bodies (truncated to ~500 chars).

1. **Telegram message → Google Sheets** (category: Communication):
   nodes: `telegram-trigger` (Telegram Trigger), `sheets-append`
   (Google Sheets Append Row); edge trigger → sheets.
2. **Daily digest email** (category: Productivity): nodes: `schedule-trigger`
   (Schedule Trigger, cron `0 8 * * *`), `http-request` (HTTP Request),
   `email-send` (Email); edges in order.
3. **Webhook → Discord notification** (category: Developer Tools): nodes:
   `webhook-trigger` (Webhook Trigger), `discord-message` (Discord Message);
   edge trigger → discord.

Each node in a definition: `{ "id", "type", "name", "position": { "x", "y" },
"config": { ... } }`. Each edge: `{ "id", "source", "target" }`.

## Frontend routes (apps/web)

`/` Dashboard · `/workflows` My Workflows · `/workflows/:id` Workflow detail
(editor arrives Phase 2 — the page shows detail, definition JSON, export) ·
`/templates` · `/integrations` · `/ai` AI Assistant · `/executions` ·
`/settings` · `/billing` · `/login` · `/register` · `/forgot-password` ·
`/reset-password?token=…`. All except the auth routes require login.
