"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ─────────────────────────────────────────────────────────
// Supported Currencies
// ─────────────────────────────────────────────────────────

export type Currency = "USD" | "TRY";

export interface CurrencyConfig {
  code: Currency;
  symbol: string;
  name: string;
  locale: string; // For Intl.NumberFormat
}

export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  TRY: { code: "TRY", symbol: "₺", name: "Turkish Lira", locale: "tr-TR" },
};

// ─────────────────────────────────────────────────────────
// Conversion Rates (Base: USD = 1.00)
// In production, fetch from API or use real-time rates
// ─────────────────────────────────────────────────────────

const CONVERSION_RATES: Record<Currency, number> = {
  USD: 1.0,
  TRY: 34.5, // 1 USD = 34.5 TRY (approx, Feb 2026)
};

// ─────────────────────────────────────────────────────────
// Cookie config
// ─────────────────────────────────────────────────────────

const COOKIE_NAME = "helvino_currency";
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

function getCookieCurrency(): Currency | null {
  const rawCurrency = getCookieValue(COOKIE_NAME);
  if (!rawCurrency) return null;
  const val = rawCurrency as Currency;
  if (val in CURRENCIES) return val;
  return null;
}

function persistCurrency(currency: Currency) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${currency};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
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
  const [currency, setCurrencyState] = useState<Currency>("USD");

  // Resolve currency once on mount:
  // - cookie override wins
  // - otherwise use backend IP-country hint (TR => TRY, else USD)
  useEffect(() => {
    const cookie = getCookieCurrency();
    if (cookie) {
      setCurrencyState(cookie);
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const controller = new AbortController();
    fetch(`${API_URL}/api/currency`, { credentials: "include", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        return data as { currency?: string } | null;
      })
      .then((data) => {
        const raw = String(data?.currency || "").trim().toLowerCase();
        const resolved: Currency = raw === "try" ? "TRY" : "USD";
        setCurrencyState(resolved);
        persistCurrency(resolved);
      })
      .catch(() => {
        // Keep USD fallback.
      });

    return () => controller.abort();
  }, []);

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    persistCurrency(newCurrency);
  }, []);

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
