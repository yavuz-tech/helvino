/**
 * Password hashing utilities using Argon2
 */

import argon2 from "argon2";

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
