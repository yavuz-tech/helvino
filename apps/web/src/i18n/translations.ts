/**
 * i18n Translations
 * 
 * Locale files are stored as JSON in ./locales/ directory
 * This file imports them and provides TypeScript type safety
 */

import enJSON from "./locales/en.json";
import trJSON from "./locales/tr.json";
import esJSON from "./locales/es.json";

// Type guard: ensure all locales have same keys as EN at build time
const EN_KEYS = Object.keys(enJSON);
const TR_KEYS = Object.keys(trJSON);
const ES_KEYS = Object.keys(esJSON);

if (EN_KEYS.length !== TR_KEYS.length || EN_KEYS.length !== ES_KEYS.length) {
  throw new Error(
    `i18n parity FAILED: EN=${EN_KEYS.length}, TR=${TR_KEYS.length}, ES=${ES_KEYS.length}`
  );
}

const enSet = new Set(EN_KEYS);
const trMissing = EN_KEYS.filter((k) => !(k in trJSON));
const esMissing = EN_KEYS.filter((k) => !(k in esJSON));

if (trMissing.length > 0) {
  throw new Error(
    `i18n parity FAILED: TR missing ${trMissing.length} keys: ${trMissing.slice(0, 5).join(", ")}`
  );
}

if (esMissing.length > 0) {
  throw new Error(
    `i18n parity FAILED: ES missing ${esMissing.length} keys: ${esMissing.slice(0, 5).join(", ")}`
  );
}

const trExtra = TR_KEYS.filter((k) => !enSet.has(k));
const esExtra = ES_KEYS.filter((k) => !enSet.has(k));

if (trExtra.length > 0) {
  throw new Error(
    `i18n parity FAILED: TR has ${trExtra.length} extra keys: ${trExtra.slice(0, 5).join(", ")}`
  );
}

if (esExtra.length > 0) {
  throw new Error(
    `i18n parity FAILED: ES has ${esExtra.length} extra keys: ${esExtra.slice(0, 5).join(", ")}`
  );
}

// All checks passed — export typed translations
const en = enJSON as Record<string, string>;
const tr = trJSON as Record<string, string>;
const es = esJSON as Record<string, string>;

export type TranslationKey = keyof typeof en;
export type Locale = "en" | "tr" | "es";
export type TranslationStrings = Record<TranslationKey, string>;

export const LOCALES: Locale[] = ["en", "tr", "es"];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_META: Record<
  Locale,
  { name: string; nativeName: string }
> = {
  en: { name: "English", nativeName: "English" },
  tr: { name: "Turkish", nativeName: "Türkçe" },
  es: { name: "Spanish", nativeName: "Español" },
};

export const translations: Record<Locale, TranslationStrings> = { en, tr, es };
