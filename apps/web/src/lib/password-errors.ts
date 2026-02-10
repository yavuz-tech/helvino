import type { TranslationKey } from "@/i18n/translations";

const PASSWORD_ERROR_TRANSLATION_MAP: Record<string, TranslationKey> = {
  PASSWORD_TOO_SHORT: "security.passwordRuleTooShort",
  PASSWORD_NEEDS_UPPERCASE: "security.passwordRuleUppercase",
  PASSWORD_NEEDS_LOWERCASE: "security.passwordRuleLowercase",
  PASSWORD_NEEDS_NUMBER: "security.passwordRuleNumber",
  PASSWORD_NEEDS_SPECIAL: "security.passwordRuleSpecial",
  PASSWORD_TOO_COMMON: "security.passwordRuleCommon",
};

export function mapPasswordPolicyError(
  t: (key: TranslationKey) => string,
  code: string | undefined,
  fallback: string
): string {
  if (!code) return fallback;
  const key = PASSWORD_ERROR_TRANSLATION_MAP[code];
  if (!key) return fallback;
  return t(key);
}
