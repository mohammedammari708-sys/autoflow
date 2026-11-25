import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { IS_PROD, JWT_SECRET } from "../config.js";
import { unauthorized } from "./errors.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const COOKIE_NAME = "autoflow_token";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * SameSite for the auth cookie. Default "lax" (same-origin deploys:
 * dev and docker-compose). Split deployments — frontend on one domain
 * and the API on another (e.g. Netlify + Render) — need "none":
 * browsers only send a SameSite=Lax cookie on same-site requests, so
 * cross-site API calls would arrive without the cookie (401).
 * SameSite=None requires Secure, so secure is forced on when "none".
 * Set COOKIE_SAMESITE=none in production for split deployments.
 */
type SameSite = "lax" | "strict" | "none";
function parseSameSite(): SameSite {
  const v = (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase();
  if (v === "lax" || v === "strict" || v === "none") return v;
  throw new Error(`[AutoFlow] COOKIE_SAMESITE must be lax, strict or none (got "${v}").`);
}
const COOKIE_SAMESITE = parseSameSite();
const COOKIE_SECURE = IS_PROD || COOKIE_SAMESITE === "none";

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "7d" },
  );
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE,
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE,
    path: "/",
  });
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/** Require a valid JWT in the httpOnly cookie; attaches req.user. */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) {
    next(unauthorized("Authentication required"));
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") {
      next(unauthorized("Invalid token"));
      return;
    }
    req.user = {
      id: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      email: typeof payload.email === "string" ? payload.email : "",
    };
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}
