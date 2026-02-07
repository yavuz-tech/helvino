/**
 * Shared Password Policy — Step 11.40
 *
 * Minimal policy:
 * - minLength: 8
 * - must include at least 1 letter (a-zA-Z)
 * - must include at least 1 digit (0-9)
 *
 * No uppercase/lowercase or special character requirements.
 */

export interface PasswordPolicyResult {
  valid: boolean;
  code?: "WEAK_PASSWORD";
  message?: string;
}

const MIN_LENGTH = 8;
const HAS_LETTER = /[a-zA-Z]/;
const HAS_DIGIT = /\d/;

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (!password || password.length < MIN_LENGTH) {
    return {
      valid: false,
      code: "WEAK_PASSWORD",
      message: `Password must be at least ${MIN_LENGTH} characters`,
    };
  }

  if (!HAS_LETTER.test(password)) {
    return {
      valid: false,
      code: "WEAK_PASSWORD",
      message: "Password must include at least one letter",
    };
  }

  if (!HAS_DIGIT.test(password)) {
    return {
      valid: false,
      code: "WEAK_PASSWORD",
      message: "Password must include at least one number",
    };
  }

  return { valid: true };
}
