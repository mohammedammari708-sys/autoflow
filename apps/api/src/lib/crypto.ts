import crypto from "node:crypto";
import { ENCRYPTION_KEY } from "../config.js";

/**
 * AES-256-GCM helpers for stored credentials (see CONTRACT.md).
 * The key is ENCRYPTION_KEY: a 32-byte hex string (64 hex chars).
 * Any other value is hashed with SHA-256 so a passphrase-shaped env
 * var still yields a valid 32-byte key. Plaintext secrets are never
 * logged — callers must not log the values passed here.
 */
function key(): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    return Buffer.from(ENCRYPTION_KEY, "hex");
  }
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

export function encrypt(plaintext: string): { encryptedValue: string; iv: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store ciphertext || auth tag as base64; iv separately (both base64).
  return {
    encryptedValue: Buffer.concat([ciphertext, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decrypt(encryptedValue: string, iv: string): string {
  const buf = Buffer.from(encryptedValue, "base64");
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
