"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useI18n } from "@/i18n/I18nContext";

// ─────────────────────────────────────────────────────────
// Supported Currencies
// ─────────────────────────────────────────────────────────

export type Currency = "USD" | "EUR" | "TRY" | "GBP";

export interface CurrencyConfig {
  code: Currency;
  symbol: string;
  name: string;
  locale: string; // For Intl.NumberFormat
}

export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  TRY: { code: "TRY", symbol: "₺", name: "Turkish Lira", locale: "tr-TR" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
};

// ─────────────────────────────────────────────────────────
// Conversion Rates (Base: USD = 1.00)
// In production, fetch from API or use real-time rates
// ─────────────────────────────────────────────────────────

const CONVERSION_RATES: Record<Currency, number> = {
  USD: 1.0,
  EUR: 0.92, // 1 USD = 0.92 EUR
  TRY: 34.5, // 1 USD = 34.5 TRY (approx, Feb 2026)
  GBP: 0.79, // 1 USD = 0.79 GBP
};

// ─────────────────────────────────────────────────────────
// Cookie config
// ─────────────────────────────────────────────────────────

const COOKIE_NAME = "helvino_currency";
const COOKIE_LOCALE_NAME = "helvino_currency_locale";
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60; // 180 days

// ─────────────────────────────────────────────────────────
// Currency detection based on locale/timezone
// ─────────────────────────────────────────────────────────

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
  );
  return match ? match[1] : null;
}

/** Read locale-bound currency cookie */
function getCookieCurrency(locale: string): Currency | null {
  const rawCurrency = getCookieValue(COOKIE_NAME);
  const rawLocale = getCookieValue(COOKIE_LOCALE_NAME);
  if (!rawCurrency || !rawLocale) return null;
  const val = rawCurrency as Currency;
  if (val in CURRENCIES && rawLocale === locale) return val;
  return null;
}

/** Detect currency from timezone */
function detectTimezoneCurrency(): Currency | null {
  if (typeof Intl === "undefined") return null;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;

    // Turkey → TRY
    if (tz.startsWith("Europe/Istanbul") || tz.startsWith("Asia/Istanbul")) {
      return "TRY";
    }

    // Eurozone countries
    const eurozoneTimezones = [
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Rome",
      "Europe/Madrid",
      "Europe/Brussels",
      "Europe/Amsterdam",
      "Europe/Vienna",
      "Europe/Lisbon",
      "Europe/Athens",
      "Europe/Helsinki",
      "Europe/Dublin",
      "Europe/Luxembourg",
      "Europe/Vilnius",
      "Europe/Riga",
      "Europe/Tallinn",
      "Europe/Ljubljana",
      "Europe/Bratislava",
      "Europe/Zagreb",
    ];

    if (eurozoneTimezones.some((s) => tz.startsWith(s))) {
      return "EUR";
    }

    // UK → GBP
    if (tz.startsWith("Europe/London")) {
      return "GBP";
    }
  } catch {
    // Intl not available
  }

  return null;
}

/** Resolve currency using priority chain */
function resolveCurrency(locale: string): Currency {
  // 1. Cookie (only for the current locale)
  const cookie = getCookieCurrency(locale);
  if (cookie) return cookie;

  // 2. Locale-based detection
  if (locale === "tr") return "TRY";
  if (locale === "es") {
    // Spain → EUR, Latin America → USD
    const timezoneCurrency = detectTimezoneCurrency();
    return timezoneCurrency === "EUR" ? "EUR" : "USD";
  }
  if (locale === "en") {
    // UK → GBP, US/others → USD
    const timezoneCurrency = detectTimezoneCurrency();
    return timezoneCurrency === "GBP" ? "GBP" : "USD";
  }

  // 3. Timezone-based fallback
  const timezoneCurrency = detectTimezoneCurrency();
  if (timezoneCurrency) return timezoneCurrency;

  // 4. Default fallback
  return "USD";
}

/** Write locale-bound cookie */
function persistCurrency(currency: Currency, locale: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${currency};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
  document.cookie = `${COOKIE_LOCALE_NAME}=${locale};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

// ─────────────────────────────────────────────────────────
// React Context
// ─────────────────────────────────────────────────────────

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  config: CurrencyConfig;
  convert: (usdAmount: number) => number;
  format: (amount: number, options?: { decimals?: number; includeSymbol?: boolean }) => string;
  formatUsd: (usdAmount: number, options?: { decimals?: number; includeSymbol?: boolean }) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/**
 * Currency Provider
 * - Detects currency from locale/timezone
 * - Provides conversion and formatting utilities
 * - Syncs with i18n locale changes
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [currency, setCurrencyState] = useState<Currency>("USD");

  // Resolve currency when locale changes
  useEffect(() => {
    const resolved = resolveCurrency(locale);
    setCurrencyState(resolved);

    // Persist cookie if auto-detected for this locale
    if (!getCookieCurrency(locale)) {
      persistCurrency(resolved, locale);
    }
  }, [locale]);

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    persistCurrency(newCurrency, locale);
  }, [locale]);

  const config = CURRENCIES[currency];

  const convert = useCallback(
    (usdAmount: number): number => {
      return usdAmount * CONVERSION_RATES[currency];
    },
    [currency]
  );

  const format = useCallback(
    (
      amount: number,
      options?: { decimals?: number; includeSymbol?: boolean }
    ): string => {
      const decimals = options?.decimals ?? 0;
      const includeSymbol = options?.includeSymbol ?? true;

      const formatted = new Intl.NumberFormat(config.locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount);

      return includeSymbol ? `${config.symbol}${formatted}` : formatted;
    },
    [config]
  );

  const formatUsd = useCallback(
    (
      usdAmount: number,
      options?: { decimals?: number; includeSymbol?: boolean }
    ): string => {
      const converted = convert(usdAmount);
      return format(converted, options);
    },
    [convert, format]
  );

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    config,
    convert,
    format,
    formatUsd,
  };

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}
