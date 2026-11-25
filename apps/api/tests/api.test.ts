/**
 * API integration tests — boots the real server on a temp SQLite DB
 * and exercises the contract end to end. Run with `npm test`.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startServer, type RunningServer } from "../src/server.js";

let base = "";
let server: RunningServer;
let tmpDir: string;

/** Minimal fetch client with a cookie jar (auth is a cookie, per contract). */
class Client {
  cookie = "";

  async req(method: string, p: string, body?: unknown) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cookie) headers.Cookie = this.cookie;
    const res = await fetch(`${base}${p}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const m = setCookie.match(/autoflow_token=([^;]*)/);
      if (m) this.cookie = m[1] ? `autoflow_token=${m[1]}` : "";
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, json: json as Record<string, any> | null, text };
  }
}

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autoflow-test-"));
  server = startServer({ port: 0, dbPath: path.join(tmpDir, "test.db") });
  await new Promise<void>((resolve) => {
    server.server.once("listening", () => resolve());
  });
  const addr = server.server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  assert.ok(port > 0, "server should listen on an ephemeral port");
  base = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("health endpoint is public and reports db ok", async () => {
  const c = new Client();
  const r = await c.req("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.json?.status, "ok");
  assert.equal(r.json?.db, "ok");
  assert.equal(r.json?.version, "0.1.0");
});

test("register -> login -> me -> create workflow -> dashboard -> logout -> 401", async () => {
  const c = new Client();

  const reg = await c.req("POST", "/api/auth/register", {
    name: "Test User",
    email: "alice@example.com",
    password: "supersecret1",
  });
  assert.equal(reg.status, 201, reg.text);
  assert.equal(reg.json?.user.email, "alice@example.com");
  assert.ok(c.cookie, "register should set the auth cookie");

  const me = await c.req("GET", "/api/auth/me");
  assert.equal(me.status, 200, me.text);
  assert.equal(me.json?.user.name, "Test User");

  const created = await c.req("POST", "/api/workflows", { name: "My first flow" });
  assert.equal(created.status, 201, created.text);
  assert.deepEqual(created.json?.workflow.definition, { nodes: [], edges: [] });
  assert.equal(created.json?.workflow.active, false);
  const workflowId = created.json?.workflow.id as string;
  assert.ok(workflowId);

  const stats = await c.req("GET", "/api/dashboard/stats");
  assert.equal(stats.status, 200, stats.text);
  assert.equal(stats.json?.totalWorkflows, 1);
  assert.equal(stats.json?.activeWorkflows, 0);
  assert.equal(stats.json?.totalExecutions, 0);
  assert.equal(stats.json?.executionsByDay.length, 7);
  assert.equal(stats.json?.recentActivity.length, 1);
  assert.equal(stats.json?.recentActivity[0].kind, "workflow");

  const out = await c.req("POST", "/api/auth/logout");
  assert.equal(out.status, 200);
  assert.equal(out.json?.ok, true);

  const afterLogout = await c.req("GET", "/api/auth/me");
  assert.equal(afterLogout.status, 401);
  assert.equal(afterLogout.json?.error.code, "UNAUTHORIZED");

  // Login again with the same credentials works.
  const login = await c.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "supersecret1",
  });
  assert.equal(login.status, 200, login.text);
  assert.equal(login.json?.user.id, reg.json?.user.id);

  // The created workflow is still there after re-login.
  const detail = await c.req("GET", `/api/workflows/${workflowId}`);
  assert.equal(detail.status, 200, detail.text);
  assert.equal(detail.json?.workflow.name, "My first flow");
});

test("wrong password is a 401 and unknown email does not leak", async () => {
  const c = new Client();
  const bad = await c.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "wrongpassword",
  });
  assert.equal(bad.status, 401);
  assert.equal(bad.json?.error.code, "UNAUTHORIZED");

  const noUser = await c.req("POST", "/api/auth/login", {
    email: "nobody@example.com",
    password: "whatever123",
  });
  assert.equal(noUser.status, 401);
});

test("cross-user isolation: user B cannot read user A's workflow", async () => {
  const a = new Client();
  await a.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "supersecret1",
  });
  const list = await a.req("GET", "/api/workflows");
  assert.equal(list.status, 200);
  const workflowId = list.json?.workflows[0].id as string;

  const b = new Client();
  const regB = await b.req("POST", "/api/auth/register", {
    name: "Bob",
    email: "bob@example.com",
    password: "supersecret2",
  });
  assert.equal(regB.status, 201, regB.text);

  const peek = await b.req("GET", `/api/workflows/${workflowId}`);
  assert.equal(peek.status, 404);
  assert.equal(peek.json?.error.code, "NOT_FOUND");

  const bList = await b.req("GET", "/api/workflows");
  assert.equal(bList.status, 200);
  assert.deepEqual(bList.json?.workflows, []);

  const bStats = await b.req("GET", "/api/dashboard/stats");
  assert.equal(bStats.json?.totalWorkflows, 0);
});

test("validation errors use the contract error shape", async () => {
  const c = new Client();
  const short = await c.req("POST", "/api/auth/register", {
    name: "X",
    email: "x@example.com",
    password: "short",
  });
  assert.equal(short.status, 400);
  assert.equal(short.json?.error.code, "VALIDATION_ERROR");

  const anon = new Client();
  const noAuth = await anon.req("GET", "/api/workflows");
  assert.equal(noAuth.status, 401);
  assert.equal(noAuth.json?.error.code, "UNAUTHORIZED");
});

test("forgot-password + reset-password flow (dev token)", async () => {
  const c = new Client();
  const forgot = await c.req("POST", "/api/auth/forgot-password", {
    email: "alice@example.com",
  });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.json?.devResetToken, "dev should return a reset token");
  const token = forgot.json?.devResetToken as string;

  // Unknown email: still 200, no token (no user enumeration).
  const unknown = await c.req("POST", "/api/auth/forgot-password", {
    email: "ghost@example.com",
  });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.json?.devResetToken, undefined);

  const reset = await c.req("POST", "/api/auth/reset-password", {
    token,
    newPassword: "newpassword1",
  });
  assert.equal(reset.status, 200, reset.text);
  assert.equal(reset.json?.ok, true);

  // Token is single-use.
  const reuse = await c.req("POST", "/api/auth/reset-password", {
    token,
    newPassword: "anotherpass1",
  });
  assert.equal(reuse.status, 400);

  const login = await c.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "newpassword1",
  });
  assert.equal(login.status, 200, login.text);
});

test("templates are seeded and import creates a real workflow", async () => {
  const c = new Client();
  await c.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "newpassword1",
  });
  const list = await c.req("GET", "/api/templates");
  assert.equal(list.status, 200);
  assert.equal(list.json?.templates.length, 3);
  const names = (list.json?.templates as Array<{ name: string }>).map((t) => t.name);
  assert.ok(names.includes("Telegram message → Google Sheets"));
  assert.ok(names.includes("Daily digest email"));
  assert.ok(names.includes("Webhook → Discord notification"));

  const tplId = list.json?.templates[0].id as string;
  const detail = await c.req("GET", `/api/templates/${tplId}`);
  assert.equal(detail.status, 200);
  assert.ok(Array.isArray(detail.json?.template.definition.nodes));
  assert.ok(detail.json?.template.definition.nodes.length >= 2);

  const imported = await c.req("POST", `/api/templates/${tplId}/import`, {});
  assert.equal(imported.status, 201, imported.text);
  assert.equal(
    imported.json?.workflow.definition.nodes.length,
    detail.json?.template.definition.nodes.length,
  );
});

test("integrations catalog is seeded, all not_configured; executions empty; system status ok", async () => {
  const c = new Client();
  await c.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "newpassword1",
  });
  const ints = await c.req("GET", "/api/integrations");
  assert.equal(ints.status, 200);
  assert.equal(ints.json?.integrations.length, 10);
  for (const i of ints.json?.integrations as Array<{ status: string }>) {
    assert.equal(i.status, "not_configured");
  }
  const slugs = (ints.json?.integrations as Array<{ slug: string }>).map((i) => i.slug);
  for (const s of ["telegram", "gmail", "google-sheets", "google-drive", "discord", "slack", "notion", "openai", "http", "webhook"]) {
    assert.ok(slugs.includes(s), `missing integration ${s}`);
  }

  const execs = await c.req("GET", "/api/executions");
  assert.equal(execs.status, 200);
  assert.deepEqual(execs.json?.executions, []);

  const sys = await c.req("GET", "/api/system/status");
  assert.equal(sys.status, 200);
  assert.equal(sys.json?.api, "ok");
  assert.equal(sys.json?.db, "ok");
  assert.equal(typeof sys.json?.uptimeSeconds, "number");
});

/* ---- Phase 3: execution engine ---- */

let phase3WorkflowId = "";
let phase3ExecutionId = "";

async function createWorkflowWithDefinition(c: Client, name: string, definition: unknown) {
  const created = await c.req("POST", "/api/workflows", { name });
  assert.equal(created.status, 201, created.text);
  const id = created.json?.workflow.id as string;
  assert.ok(id);
  const patched = await c.req("PATCH", `/api/workflows/${id}`, { definition });
  assert.equal(patched.status, 200, patched.text);
  return id;
}

test("Phase 3: manual run with a real HTTP Request node against a local stub succeeds", async () => {
  const c = new Client();
  await c.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "newpassword1",
  });

  // Local stub — no external network dependency.
  const stub = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, hello: "world" }));
  });
  await new Promise<void>((resolve) => stub.listen(0, "127.0.0.1", () => resolve()));
  const addr = stub.address();
  assert.ok(typeof addr === "object" && addr, "stub should be listening");
  const stubUrl = `http://127.0.0.1:${(addr as { port: number }).port}/ping`;

  try {
    phase3WorkflowId = await createWorkflowWithDefinition(c, "Phase 3 stub flow", {
      nodes: [
        { id: "t1", type: "manual-trigger", name: "Manual Trigger", position: { x: 0, y: 0 }, config: {} },
        { id: "h1", type: "http-request", name: "HTTP Request", position: { x: 200, y: 0 }, config: { url: stubUrl, method: "GET" } },
      ],
      edges: [{ id: "e1", source: "t1", target: "h1" }],
    });

    const run = await c.req("POST", `/api/workflows/${phase3WorkflowId}/run`, {});
    assert.equal(run.status, 200, run.text);
    assert.equal(run.json?.execution.status, "success", run.text);
    assert.equal(run.json?.execution.error, null);
    assert.ok(run.json?.execution.id, "run should return an execution id");
    assert.equal(run.json?.execution.workflowId, phase3WorkflowId);
    const nodes = run.json?.nodes as Array<{ nodeId: string; status: string }>;
    assert.equal(nodes.length, 2);
    assert.deepEqual(nodes.map((n) => n.nodeId), ["t1", "h1"]);
    assert.ok(nodes.every((n) => n.status === "success"));
    phase3ExecutionId = run.json?.execution.id as string;

    const detail = await c.req("GET", `/api/executions/${phase3ExecutionId}`);
    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.json?.execution.id, phase3ExecutionId);
    assert.equal(detail.json?.execution.status, "success");
    const logs = detail.json?.logs as Array<{ nodeId: string; level: string; data: unknown }>;
    assert.equal(logs.length, 2, detail.text);
    assert.ok(logs.every((l) => l.level === "info"));
    assert.deepEqual(logs.map((l) => l.nodeId), ["t1", "h1"]);
    const httpLog = logs.find((l) => l.nodeId === "h1");
    assert.equal((httpLog?.data as { httpStatus: number }).httpStatus, 200);
  } finally {
    await new Promise<void>((resolve) => stub.close(() => resolve()));
  }
});

test("Phase 3: Telegram node fails honestly — not configured, never faked", async () => {
  const c = new Client();
  await c.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "newpassword1",
  });
  const workflowId = await createWorkflowWithDefinition(c, "Phase 3 telegram flow", {
    nodes: [
      { id: "tg1", type: "telegram-trigger", name: "Telegram Trigger", position: { x: 0, y: 0 }, config: { chatId: "", keyword: "" } },
      { id: "s1", type: "google-sheets-append", name: "Google Sheets Append Row", position: { x: 200, y: 0 }, config: { spreadsheetId: "", sheet: "Sheet1", columns: ["message"] } },
    ],
    edges: [{ id: "e1", source: "tg1", target: "s1" }],
  });

  const run = await c.req("POST", `/api/workflows/${workflowId}/run`, {});
  assert.equal(run.status, 200, run.text);
  assert.equal(run.json?.execution.status, "failed", run.text);
  assert.match(run.json?.execution.error as string, /not configured/i);
  assert.match(run.json?.execution.error as string, /Telegram/);
  // Walk stopped at the failing node: only the Telegram node ran.
  const nodes = run.json?.nodes as Array<{ nodeId: string; status: string; error?: string }>;
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].nodeId, "tg1");
  assert.equal(nodes[0].status, "failed");
  assert.match(nodes[0].error ?? "", /not configured/i);

  const detail = await c.req("GET", `/api/executions/${run.json?.execution.id}`);
  assert.equal(detail.status, 200, detail.text);
  const logs = detail.json?.logs as Array<{ nodeId: string; level: string; message: string }>;
  assert.equal(logs.length, 1);
  assert.equal(logs[0].nodeId, "tg1");
  assert.equal(logs[0].level, "error");
  assert.match(logs[0].message, /not configured/i);
});

test("Phase 3: ownership isolation — user B cannot run or read user A's workflow/execution", async () => {
  const b = new Client();
  await b.req("POST", "/api/auth/login", {
    email: "bob@example.com",
    password: "supersecret2",
  });
  const run = await b.req("POST", `/api/workflows/${phase3WorkflowId}/run`, {});
  assert.equal(run.status, 404);
  assert.equal(run.json?.error.code, "NOT_FOUND");

  const peek = await b.req("GET", `/api/executions/${phase3ExecutionId}`);
  assert.equal(peek.status, 404);
  assert.equal(peek.json?.error.code, "NOT_FOUND");
});

test("Phase 3: workflow with no nodes fails with a clear error, not a 500", async () => {
  const c = new Client();
  await c.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "newpassword1",
  });
  const created = await c.req("POST", "/api/workflows", { name: "Empty flow" });
  assert.equal(created.status, 201, created.text);
  const workflowId = created.json?.workflow.id as string;

  const run = await c.req("POST", `/api/workflows/${workflowId}/run`, {});
  assert.equal(run.status, 200, run.text);
  assert.equal(run.json?.execution.status, "failed");
  assert.match(run.json?.execution.error as string, /no nodes/i);
  assert.ok(run.json?.execution.finishedAt, "failed execution should have finishedAt");

  const detail = await c.req("GET", `/api/executions/${run.json?.execution.id}`);
  assert.equal(detail.status, 200, detail.text);
  const logs = detail.json?.logs as Array<{ level: string }>;
  assert.ok(logs.length >= 1);
  assert.equal(logs[0].level, "error");
});

test("Phase 3: HTTP Request with a non-http(s) URL fails honestly", async () => {
  const c = new Client();
  await c.req("POST", "/api/auth/login", {
    email: "alice@example.com",
    password: "newpassword1",
  });
  const workflowId = await createWorkflowWithDefinition(c, "Phase 3 bad URL flow", {
    nodes: [
      { id: "t1", type: "manual-trigger", name: "Manual Trigger", position: { x: 0, y: 0 }, config: {} },
      { id: "h1", type: "http-request", name: "HTTP Request", position: { x: 200, y: 0 }, config: { url: "ftp://example.com/x", method: "GET" } },
    ],
    edges: [{ id: "e1", source: "t1", target: "h1" }],
  });
  const run = await c.req("POST", `/api/workflows/${workflowId}/run`, {});
  assert.equal(run.status, 200, run.text);
  assert.equal(run.json?.execution.status, "failed");
  assert.match(run.json?.execution.error as string, /http:\/\/ or https:\/\//);
  const nodes = run.json?.nodes as Array<{ nodeId: string; status: string }>;
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].status, "success");
  assert.equal(nodes[1].status, "failed");
});
