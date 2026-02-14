/**
 * Password hashing utilities using Argon2
 */

import argon2 from "argon2";

export const PASSWORD_STRENGTH_ERROR_MESSAGE =
  "Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character";

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
 * Validate password strength using baseline complexity rules.
 */
export function validatePasswordStrength(
  password: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const value = password || "";

  if (value.length < 8) {
    errors.push("minimum_length");
  }
  if (!/[A-Z]/.test(value)) {
    errors.push("uppercase");
  }
  if (!/[a-z]/.test(value)) {
    errors.push("lowercase");
  }
  if (!/[0-9]/.test(value)) {
    errors.push("number");
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    errors.push("special");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
