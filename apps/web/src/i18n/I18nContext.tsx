"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  type Locale,
  type TranslationKey,
  translations,
  DEFAULT_LOCALE,
  LOCALES,
} from "./translations";

// ─────────────────────────────────────────────────────────
// Cookie config
// ─────────────────────────────────────────────────────────
const COOKIE_NAME = "helvino_lang";
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60; // 180 days

// ─────────────────────────────────────────────────────────
// Language detection priority:
//   1. Cookie (user previously chose a language → ALWAYS respect)
//   2. navigator.language / navigator.languages (browser setting)
//   3. Timezone-based country guess (TR → tr, ES/MX/AR/CO/CL → es)
//   4. Fallback → "en"
// ─────────────────────────────────────────────────────────

/** Read cookie value */
function getCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`)
  );
  if (match) {
    const val = match[1] as Locale;
    if (LOCALES.includes(val)) return val;
  }
  return null;
}

/** Detect from browser Accept-Language / navigator.languages */
function detectBrowserLocale(): Locale | null {
  if (typeof navigator === "undefined") return null;

  // navigator.languages is an ordered list of user-preferred languages
  const candidates: string[] = [];
  if (navigator.languages && navigator.languages.length > 0) {
    candidates.push(...navigator.languages);
  } else if (navigator.language) {
    candidates.push(navigator.language);
  }

  for (const raw of candidates) {
    const lang = raw.slice(0, 2).toLowerCase();
    if (LOCALES.includes(lang as Locale)) return lang as Locale;
  }

  return null;
}

/** Timezone-based country fallback (no network call needed) */
function detectTimezoneLocale(): Locale | null {
  if (typeof Intl === "undefined") return null;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Europe/Istanbul"
    if (!tz) return null;

    // Turkish timezones
    if (tz.startsWith("Europe/Istanbul") || tz.startsWith("Asia/Istanbul")) {
      return "tr";
    }

    // Spanish-speaking countries
    const spanishTimezones = [
      "Europe/Madrid",
      "Atlantic/Canary",
      "America/Mexico_City",
      "America/Cancun",
      "America/Merida",
      "America/Monterrey",
      "America/Buenos_Aires",
      "America/Argentina",
      "America/Bogota",
      "America/Santiago",
      "America/Lima",
      "America/Caracas",
      "America/Guayaquil",
      "America/La_Paz",
      "America/Asuncion",
      "America/Montevideo",
      "America/Tegucigalpa",
      "America/Managua",
      "America/Guatemala",
      "America/El_Salvador",
      "America/Costa_Rica",
      "America/Panama",
      "America/Havana",
      "America/Santo_Domingo",
    ];

    if (spanishTimezones.some((s) => tz.startsWith(s))) {
      return "es";
    }
  } catch {
    // Intl not available
  }

  return null;
}

/** Resolve the best locale using the priority chain */
function resolveLocale(): Locale {
  // 1. Cookie → user explicitly chose → ALWAYS respect
  const cookie = getCookieLocale();
  if (cookie) return cookie;

  // 2. Browser language (Accept-Language equivalent on client)
  const browser = detectBrowserLocale();
  if (browser) return browser;

  // 3. Timezone-based country guess
  const timezone = detectTimezoneLocale();
  if (timezone) return timezone;

  // 4. Fallback
  return DEFAULT_LOCALE;
}

/** Write the cookie */
function persistLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${locale};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
  document.documentElement.lang = locale;
}

// ─────────────────────────────────────────────────────────
// React Context
// ─────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * HYDRATION-SAFE i18n strategy:
 *
 * 1. Both SSR and the first client render use DEFAULT_LOCALE ("en").
 *    This guarantees the HTML matches and React hydration succeeds
 *    with ZERO warnings — no matter what locale the user has.
 *
 * 2. Immediately after hydration, useEffect resolves the real locale
 *    (cookie → browser → timezone → "en") and React re-renders with
 *    the correct language.
 *
 * 3. The blocking <script> in layout.tsx hides the body (opacity:0)
 *    for non-English cookie holders, so the English frame is never
 *    visible. The useEffect below reveals it once the correct locale
 *    is applied.
 *
 * Result: zero hydration warnings, zero English flash.
 */

export function I18nProvider({ children }: { children: ReactNode }) {
  // ALWAYS start with DEFAULT_LOCALE on both server and client.
  // This is the key to preventing hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // After hydration, resolve the real locale and switch.
  useEffect(() => {
    const resolved = resolveLocale();
    if (resolved !== DEFAULT_LOCALE) {
      setLocaleState(resolved);
    }

    // Persist cookie if auto-detected (no explicit user choice yet)
    if (!getCookieLocale()) {
      persistLocale(resolved);
    }
    document.documentElement.lang = resolved;

    // Reveal body — the blocking script in layout.tsx hid it (opacity:0)
    // for non-English locales to prevent English flash. Now that React has
    // re-rendered with the correct locale, show the content.
    if (document.documentElement.dataset.i18nReady === "pending") {
      document.body.style.opacity = "1";
      document.body.style.transition = "opacity 0.02s ease-in";
      delete document.documentElement.dataset.i18nReady;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    persistLocale(newLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string>): string => {
      const strings = translations[locale];
      let result = strings[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(new RegExp(`\\{${k}\\}`, "g"), v);
        }
      }
      return result;
    },
    [locale]
  );

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
