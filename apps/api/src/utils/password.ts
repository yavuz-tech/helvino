/**
 * Password hashing utilities using Argon2
 */

import argon2 from "argon2";
import { validatePasswordPolicy } from "./password-policy";

export const PASSWORD_STRENGTH_ERROR_MESSAGE =
  "Password must contain at least 12 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character, and must not be a common password";

const DUMMY_HASH_PROMISE = argon2.hash("helvino_dummy_password_for_timing", {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
});

/**
 * Hash a plain-text password using Argon2id
 * @param password Plain-text password
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a plain-text password against a hash
 * @param hash Stored password hash
 * @param password Plain-text password to verify
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    // Invalid hash format or other error
    return false;
  }
}

/**
 * Verify password with a dummy Argon2 hash fallback.
 *
 * Use this when the user record may not exist, to reduce timing/user-enumeration
 * differences between "unknown email" and "known email + wrong password".
 */
export async function verifyPasswordWithDummy(
  hash: string | null | undefined,
  password: string
): Promise<boolean> {
  const effectiveHash = hash || (await DUMMY_HASH_PROMISE);
  return verifyPassword(effectiveHash, password);
}

/**
 * Validate password strength using baseline complexity rules.
 */
export function validatePasswordStrength(
  password: string
): { valid: boolean; errors: string[] } {
  const result = validatePasswordPolicy(password);
  if (result.valid) return { valid: true, errors: [] };

  // Keep the legacy (simple) error list contract for existing callsites.
  const errors: string[] = [];
  switch (result.code) {
    case "PASSWORD_TOO_SHORT":
      errors.push("minimum_length");
      break;
    case "PASSWORD_NEEDS_UPPERCASE":
      errors.push("uppercase");
      break;
    case "PASSWORD_NEEDS_LOWERCASE":
      errors.push("lowercase");
      break;
    case "PASSWORD_NEEDS_NUMBER":
      errors.push("number");
      break;
    case "PASSWORD_NEEDS_SPECIAL":
      errors.push("special");
      break;
    case "PASSWORD_TOO_COMMON":
      errors.push("too_common");
      break;
    default:
      errors.push("invalid");
  }
  return { valid: false, errors };
}
