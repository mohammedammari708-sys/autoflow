import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const IS_PROD = NODE_ENV === "production";
export const PORT = Number(process.env.PORT ?? 4000);
export const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";
export const VERSION = "0.1.0";

/**
 * In production the secret must be set — the server refuses to start
 * without it. In dev an ephemeral random value is generated per run
 * with a loud console warning (sessions do not survive a restart).
 */
function requiredOrEphemeral(name: string): string {
  const value = process.env[name];
  if (value) return value;  if (IS_PROD) {
    throw new Error(`[AutoFlow] ${name} must be set in production (see .env.example). Refusing to start.`);
  }
  const generated = crypto.randomBytes(32).toString("hex");
  console.warn(
    `[AutoFlow WARNING] ${name} is not set — using an EPHEMERAL random value for this run only. ` +
      `Sessions/encrypted credentials will NOT survive a restart. Set ${name} in apps/api/.env.`,
  );
  return generated;
}

export const JWT_SECRET = requiredOrEphemeral("JWT_SECRET");
export const ENCRYPTION_KEY = requiredOrEphemeral("ENCRYPTION_KEY");

export const DATABASE_URL = process.env.DATABASE_URL ?? "./data/autoflow.db";

export function resolveDbPath(): string {
  return path.isAbsolute(DATABASE_URL)
    ? DATABASE_URL
    : path.resolve(process.cwd(), DATABASE_URL);
}

/** Auth rate limit: 10 requests / 15 min per IP in production, 100 in dev. */
export const AUTH_RATE_LIMIT_MAX = IS_PROD ? 10 : 100;
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
