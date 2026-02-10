export type PasswordPolicyCode =
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_NEEDS_UPPERCASE"
  | "PASSWORD_NEEDS_LOWERCASE"
  | "PASSWORD_NEEDS_NUMBER"
  | "PASSWORD_NEEDS_SPECIAL"
  | "PASSWORD_TOO_COMMON";

export interface PasswordPolicyResult {
  valid: boolean;
  code?: PasswordPolicyCode;
  message?: string;
}

const MIN_LENGTH = 12;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /\d/;
const HAS_SPECIAL = /[!@#$%^&*]/;

const COMMON_PASSWORDS = new Set([
  "password",
  "123456",
  "qwerty",
  "admin",
  "welcome",
]);

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const normalized = (password || "").trim().toLowerCase();

  if (!password || password.length < MIN_LENGTH) {
    return {
      valid: false,
      code: "PASSWORD_TOO_SHORT",
      message: `Password must be at least ${MIN_LENGTH} characters`,
    };
  }

  if (COMMON_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      code: "PASSWORD_TOO_COMMON",
      message: "Password is too common. Please choose a stronger password",
    };
  }

  if (!HAS_UPPERCASE.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_NEEDS_UPPERCASE",
      message: "Password must include at least one uppercase letter",
    };
  }

  if (!HAS_LOWERCASE.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_NEEDS_LOWERCASE",
      message: "Password must include at least one lowercase letter",
    };
  }

  if (!HAS_NUMBER.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_NEEDS_NUMBER",
      message: "Password must include at least one number",
    };
  }

  if (!HAS_SPECIAL.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_NEEDS_SPECIAL",
      message: "Password must include at least one special character (!@#$%^&*)",
    };
  }

  return { valid: true };
}
