/**
 * MFA Secret Encryption Utility
 *
 * Encrypts/decrypts TOTP MFA secrets using AES-256-GCM before storing in database.
 * This prevents MFA secrets from being compromised in a database breach.
 *
 * Environment variable: MFA_ENCRYPTION_KEY (64-char hex = 32 bytes)
 *
 * MIGRATION NOTE:
 * Existing plaintext MFA secrets are supported via automatic detection.
 * When decrypting, if the value doesn't look like an encrypted payload
 * (no ":" separator), it is returned as-is (assumed plaintext legacy secret).
 * On next MFA re-enrollment or admin action, the secret will be encrypted.
 *
 * To generate a key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits, recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.MFA_ENCRYPTION_KEY;
  if (!keyHex) return null;
  if (keyHex.length !== 64) {
    console.error(
      "[mfa-encryption] MFA_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got:",
      keyHex.length
    );
    return null;
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt an MFA secret for database storage.
 * Returns format: "iv:authTag:ciphertext" (all hex-encoded).
 * If MFA_ENCRYPTION_KEY is not configured, returns plaintext (backward compat).
 */
export function encryptMfaSecret(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    // No encryption key configured — store plaintext (legacy mode).
    // Log a warning in production.
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[mfa-encryption] WARNING: MFA_ENCRYPTION_KEY not set — storing MFA secret in plaintext"
      );
    }
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an MFA secret from database storage.
 * Handles both encrypted ("iv:authTag:ciphertext") and plaintext (legacy) formats.
 */
export function decryptMfaSecret(stored: string): string {
  // Detect legacy plaintext: base32 TOTP secrets don't contain ":"
  if (!stored.includes(":")) {
    return stored;
  }

  const parts = stored.split(":");
  if (parts.length !== 3) {
    // Unexpected format — return as-is to avoid breaking existing MFA
    console.warn("[mfa-encryption] Unexpected MFA secret format, returning as-is");
    return stored;
  }

  const key = getEncryptionKey();
  if (!key) {
    // Encryption key not available but data is encrypted — cannot decrypt
    throw new Error(
      "MFA_ENCRYPTION_KEY is required to decrypt MFA secrets. Set the environment variable."
    );
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
