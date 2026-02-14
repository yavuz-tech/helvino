/**
 * TOTP / MFA Utilities — Step 11.20
 *
 * Uses otpauth library (RFC 6238) for TOTP generation and verification.
 * Backup codes are SHA-256 hashed before storage.
 */

import crypto from "crypto";
import * as OTPAuth from "otpauth";
import { encryptMfaSecret, decryptMfaSecret } from "./mfa-encryption";

const ISSUER = "Helvion";
const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const BACKUP_CODE_COUNT = 8;

// ── TOTP ──

export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function getTotpUri(secret: string, email: string, label?: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: label || email,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  // Allow 1 window before/after (30 seconds tolerance)
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

// ── Backup Codes ──

function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code.toLowerCase().trim()).digest("hex");
}

export function generateBackupCodes(): { raw: string[]; hashed: string[] } {
  const raw: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Format: XXXX-XXXX (8 hex chars with dash)
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
    raw.push(formatted);
    hashed.push(hashBackupCode(formatted));
  }

  return { raw, hashed };
}

/**
 * Try to consume a backup code. Returns new hashed array if valid, null if not.
 */
export function tryConsumeBackupCode(
  code: string,
  hashedCodes: string[]
): string[] | null {
  const codeHash = hashBackupCode(code);
  const index = hashedCodes.indexOf(codeHash);
  if (index === -1) return null;

  // Remove used code
  const remaining = [...hashedCodes];
  remaining.splice(index, 1);
  return remaining;
}

// ── MFA Secret Encryption Helpers ──

/**
 * Encrypt an MFA secret before storing in database.
 * When MFA_ENCRYPTION_KEY is set, the secret is AES-256-GCM encrypted.
 * Without the key, it falls back to plaintext (legacy mode).
 */
export { encryptMfaSecret, decryptMfaSecret };

// ── Step-Up ──

export const STEP_UP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function isStepUpValid(stepUpUntil?: number | null): boolean {
  if (!stepUpUntil) return false;
  return Date.now() < stepUpUntil;
}
