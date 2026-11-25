import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  IS_PROD,
  WEB_ORIGIN,
} from "../config.js";
import { setAuthCookie, clearAuthCookie, requireAuth, signToken } from "../lib/auth.js";
import type { Db } from "../lib/db.js";
import { nowIso } from "../lib/db.js";
import { sha256Hex } from "../lib/crypto.js";
import {
  ApiError,
  asyncHandler,
  unauthorized,
  validationError,
} from "../lib/errors.js";

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

function publicUser(row: UserRow) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

/** Parse + validate a body with zod; unknown fields rejected (.strict()). */
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

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  limit: AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts — please try again in 15 minutes.",
      },
    });
  },
});

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.string().trim().toLowerCase().email("A valid email is required"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("A valid email is required"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

const profileSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
  })
  .strict();

const forgotSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("A valid email is required"),
  })
  .strict();

const resetSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
  })
  .strict();

export function createAuthRouter(db: Db): Router {
  const router = Router();

  router.post(
    "/register",
    authLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const body = validate(registerSchema, req.body);
      const existing = db
        .prepare("SELECT id FROM users WHERE email = ?")
        .get(body.email) as unknown as { id: string } | undefined;
      if (existing) {
        throw validationError("An account with this email already exists");
      }
      const id = crypto.randomUUID();
      const now = nowIso();
      const passwordHash = await bcrypt.hash(body.password, 10);
      db.prepare(
        "INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, body.name, body.email, passwordHash, now, now);
      db.prepare(
        "INSERT INTO profiles (user_id, language, theme, created_at, updated_at) VALUES (?, 'en', 'light', ?, ?)",
      ).run(id, now, now);
      // Brand-new users start on the Free plan (CONTRACT.md).
      db.prepare(
        "INSERT INTO subscriptions (id, user_id, plan, status, current_period_end, created_at) VALUES (?, ?, 'Free', 'active', NULL, ?)",
      ).run(crypto.randomUUID(), id, now);

      const user: UserRow = {
        id,
        name: body.name,
        email: body.email,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      };
      setAuthCookie(res, signToken(publicUser(user)));
      res.status(201).json({ user: publicUser(user) });
    }),
  );

  router.post(
    "/login",
    authLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const body = validate(loginSchema, req.body);
      const user = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(body.email) as unknown as UserRow | undefined;
      if (!user) {
        throw unauthorized("Invalid email or password");
      }
      const ok = await bcrypt.compare(body.password, user.password_hash);
      if (!ok) {
        throw unauthorized("Invalid email or password");
      }
      setAuthCookie(res, signToken(publicUser(user)));
      res.json({ user: publicUser(user) });
    }),
  );

  router.post(
    "/logout",
    requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      clearAuthCookie(res);
      res.json({ ok: true });
    }),
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const user = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(req.user!.id) as unknown as UserRow | undefined;
      if (!user) throw unauthorized("Account not found");
      res.json({ user: publicUser(user) });
    }),
  );

  router.patch(
    "/profile",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const body = validate(profileSchema, req.body);
      const now = nowIso();
      db.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?").run(
        body.name,
        now,
        req.user!.id,
      );
      const user = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(req.user!.id) as unknown as UserRow | undefined;
      if (!user) throw unauthorized("Account not found");
      res.json({ user: publicUser(user) });
    }),
  );

  router.post(
    "/forgot-password",
    authLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const body = validate(forgotSchema, req.body);
      // Always 200 — no user enumeration.
      const user = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(body.email) as unknown as UserRow | undefined;
      let devToken: string | undefined;
      if (user) {
        // Invalidate any previous unused tokens for this user.
        db.prepare("DELETE FROM password_resets WHERE user_id = ? AND used = 0").run(user.id);
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        db.prepare(
          "INSERT INTO password_resets (id, user_id, token_hash, expires_at, used) VALUES (?, ?, ?, ?, 0)",
        ).run(crypto.randomUUID(), user.id, sha256Hex(token), expiresAt);
        devToken = token;
      }
      const payload: Record<string, unknown> = {
        message: "If an account exists, a reset link was sent.",
      };
      // SMTP is NOT configured: in dev only, return the token so the flow
      // can be tested. Never included in production.
      if (!IS_PROD && devToken) {
        payload.devResetToken = devToken;
        payload.devResetLink = `${WEB_ORIGIN}/reset-password?token=${devToken}`;
      }
      res.json(payload);
    }),
  );

  router.post(
    "/reset-password",
    asyncHandler(async (req: Request, res: Response) => {
      const body = validate(resetSchema, req.body);
      const row = db
        .prepare(
          "SELECT * FROM password_resets WHERE token_hash = ? AND used = 0",
        )
        .get(sha256Hex(body.token)) as
        | { id: string; user_id: string; expires_at: string }
        | undefined;
      if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid or expired reset token");
      }
      const passwordHash = await bcrypt.hash(body.newPassword, 10);
      db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
        passwordHash,
        nowIso(),
        row.user_id,
      );
      db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(row.id);
      res.json({ ok: true });
    }),
  );

  return router;
}
