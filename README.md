# AutoFlow — Automate Everything. Simply.

A real, runnable workflow automation platform (n8n/Make-inspired, original
identity). This repository is Phase 1 (Foundation). Later phases add the visual
editor, execution engine, integrations, and AI.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS (`apps/web`)
- **Backend:** Node.js + TypeScript + Express (`apps/api`)
- **Database:** SQLite (file-based, zero setup). The schema mirrors the
  production tables so a later move to Supabase/PostgreSQL is a migration,
  not a rewrite.
- **Auth:** bcrypt password hashing + JWT in an httpOnly cookie.

## Launch (development)

Prerequisites: Node.js 20+ and npm.

```bash
# 1. Backend env (from the repo root)
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env if you want: JWT_SECRET and ENCRYPTION_KEY are
# auto-generated per-run in dev with a loud warning when unset.
# In production both MUST be set to long random values.

# 2. Install + run (two terminals, or use bash scripts/dev.sh)
cd apps/api && npm install && npm run dev     # API on http://localhost:4000
cd apps/web && npm install && npm run dev     # Web on http://localhost:5173
```

Open http://localhost:5173, register an account, and use the app.
The dashboard starts at zero workflows / zero executions — that is real data
from the database, not mock data.

## Frontend (apps/web)

React 19 + TypeScript (strict) + Vite 6 + Tailwind CSS v4
(`@tailwindcss/vite`), `react-router-dom` only — no component library.
The app is a small original design system in `src/components/ui/`
(Button, Card, Input/Textarea/Select, Modal, Badge, Spinner, EmptyState,
Toast, Sidebar, Topbar) with rounded cards, soft shadows and dark mode.

- **API client:** `src/lib/api.ts` — typed `fetch` wrapper, relative
  `/api/...` paths proxied to `http://localhost:4000` by Vite
  (`vite.config.ts`), `credentials: 'include'` on every request. Auth is a
  JWT httpOnly cookie; nothing auth-related lives in localStorage.
- **Auth:** `src/context/AuthContext.tsx` loads `GET /api/auth/me` on
  startup; protected routes redirect to `/login` when unauthenticated.
- **Theme:** light/dark via the `dark` class on `<html>`, persisted in
  `localStorage` (`autoflow-theme`), toggle in the Topbar and in Settings.
- **i18n:** typed context in `src/i18n/` (`en.ts` complete; `ar.ts` and
  `fr.ts` cover navigation, dashboard, common, auth and settings strings,
  everything else falls back to English). Arabic sets `dir="rtl"` and
  `lang="ar"` on `<html>`. Switcher in the Topbar and in Settings.
- **Pages:** Dashboard (real stats + CSS bar chart of executions by day +
  system status + popular templates + quick-create), My Workflows
  (search/filter/create/delete), Workflow detail (rename, activate,
  definition JSON, export download, delete; the visual editor button is
  disabled — Phase 2), Templates (detail modal + real import),
  Integrations (catalog grouped by category, all "Not configured",
  Connect disabled — Phase 4), AI Assistant (honest "requires
  configuration" empty state, input disabled — Phase 5), Execution
  History (real, empty until Phase 3), Settings (profile, theme,
  language, logout), Billing (Free/Pro/Business from
  `src/lib/plans.ts`, Free is current, upgrades disabled — no payments
  connected). No mock data anywhere; empty states say so.
- **Scripts:** `npm run dev` (Vite on :5173), `npm run build`
  (`tsc -b && vite build`), `npm run preview`, `npm test` (`tsc -b`).

## What works in Phase 1

- Register / login / logout / password reset (token flow; SMTP is NOT
  configured — in dev the reset token is shown on screen, clearly labelled
  DEV ONLY, so the flow can be tested).
- User profile, protected API routes and protected frontend routes.
- Dashboard with real stats from the database, quick-create workflow
  (creates a real empty workflow draft), system status (real API + DB
  health), and a templates list seeded with real template records.
- Workflows list, workflow detail (rename, activate/deactivate, delete,
  view definition JSON, export JSON).
- Templates: browse + import a template into a real workflow.
- Integrations: catalog only — every integration is honestly marked
  "not configured"; connecting one arrives in Phase 4.
- AI Assistant page: honestly states AI requires configuration
  (Phase 5); it generates nothing yet.
- Execution History: real, empty until Phase 3 runs executions.
- Settings: theme (light/dark, persisted), language (English / العربية RTL /
  Français), profile.
- Billing: plan definitions and current plan (Free by default); no payment
  integration — upgrade buttons are clearly marked unavailable.

## What is NOT configured (honest list)

- **Supabase / PostgreSQL:** not connected. SQLite is used locally on
  purpose. Moving to Supabase later means: create a Supabase project,
  set `DATABASE_URL`, run the same migrations against Postgres, and switch
  the data layer — the schema is designed for that.
- **OAuth (Google, Telegram, etc.):** not configured. Integrations are
  catalog entries only in Phase 1.
- **SMTP / email sending:** not configured. Password-reset tokens are
  shown in dev only; in production they must be emailed.
- **Payments:** no provider connected. Billing shows plans only.
- **AI provider:** no API key configured. The AI page says so.

## Project layout

```
apps/
  api/        Express + TypeScript backend, SQLite schema + migrations
  web/        React + TypeScript + Vite + Tailwind frontend
scripts/
  dev.sh      Starts API + web together for local development
CONTRACT.md   The API contract both apps implement
```

## Scripts

- `bash scripts/dev.sh` — run API + web together (Ctrl+C stops both).
- `npm run build` in each app — production build.
- `npm test` in each app — tests.

## Deployment

See **[DEPLOY.md](DEPLOY.md)** — step-by-step guide (in Darija) for
putting AutoFlow on the internet from a phone, with the free-tier
limits (verified 2026-11-25).

What ships in this repo:

- `apps/api/Dockerfile` + `apps/web/Dockerfile` — production images
  (API on Node 24, web on nginx).
- `docker-compose.yml` — same-origin stack (web proxies `/api` to the
  API; data in the `autoflow-data` volume).
- `render.yaml` — Render blueprint: free API web service + free static
  site. Demo only on the free tier: Render's free filesystem is
  ephemeral, so the SQLite file is lost on restart.
- `netlify.toml` — Netlify static site for the web app.
- Split deployments (frontend and API on different domains) work via
  `VITE_API_URL` (build-time, web) + `COOKIE_SAMESITE=none` (API) —
  see `.env.example` in each app.
- The durable path is Supabase PostgreSQL, but the backend migration
  from SQLite to Postgres is **not done yet** — see DEPLOY.md, path B.

## Environment variables

See `apps/api/.env.example` (the only place secrets live; never commit a
real `.env`). Frontend code contains no secrets. The API loads `.env` via
`dotenv` on startup.

## Backend API (`apps/api`)

- Stack: Node.js 24 + TypeScript + Express, SQLite via built-in
  `node:sqlite` (no native modules), `bcryptjs`, `jsonwebtoken`, `zod`.
- `npm run dev` — `tsx watch src/index.ts` (API on `http://localhost:4000`).
  `npm run build` — `tsc` + copies migrations to `dist/`; `npm start` runs
  the compiled output. `npm test` boots the real server on a temp DB and
  exercises register → login → me → create workflow → dashboard → logout,
  wrong-password 401, cross-user isolation, and the password-reset flow.
- Database: `apps/api/data/autoflow.db`, created on first start from the
  versioned SQL migrations in `apps/api/src/migrations/` (foreign keys ON).
  Seeds (idempotent): 3 workflow templates + the 10-integration catalog,
  all integrations `not_configured`.
- Auth: bcryptjs cost 10, JWT HS256 (7d) in an httpOnly cookie
  `autoflow_token` (SameSite=Lax). `JWT_SECRET` and `ENCRYPTION_KEY`
  (32-byte hex, AES-256-GCM for stored credentials) are **required in
  production** — the server refuses to start without them. In development
  they are auto-generated per run with a loud warning (sessions do not
  survive a restart).
- Rate limiting on login/register/forgot-password: 10 requests / 15 min
  per IP in production, 100 / 15 min in development (so tests don't trip
  it). Helmet headers, CORS restricted to `WEB_ORIGIN` with credentials,
  JSON body limit 1 MB, zod validation on every mutating endpoint.
- Password reset: token flow in the `password_resets` table (SHA-256
  hashed token, 1-hour expiry, single-use). SMTP is NOT configured — in
  dev only, the forgot-password response includes `devResetToken` /
  `devResetLink`; in production it never does.
- All endpoints, shapes, and error format are defined in `CONTRACT.md`.
  Every workflow/execution query is scoped to the logged-in user.
  Registering creates a `profiles` row and a Free-plan `subscriptions`
  row; creating a workflow also creates `workflow_versions` version 1.
