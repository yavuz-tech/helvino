"use client";

import { useSyncExternalStore } from "react";

/**
 * Returns `true` after the component has hydrated on the client.
 *
 * During SSR and the very first client render this returns `false`,
 * ensuring any client-dependent values (Date.now(), navigator, etc.)
 * are not used in the initial render — which prevents hydration
 * mismatch warnings.
 *
 * Usage:
 *   const hydrated = useHydrated();
 *   return <span>{hydrated ? new Date(ts).toLocaleString() : "…"}</span>;
 */

// Using useSyncExternalStore for a tear-free, SSR-safe approach
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}

/**
 * Hook that formats a date string only after hydration,
 * preventing SSR/CSR mismatch from locale-dependent formatting.
 *
 * Returns "…" during SSR / first render, then the formatted string.
 */
export function useFormattedDate(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  placeholder = "…"
): string {
  const hydrated = useHydrated();
  if (!hydrated || !dateInput) return placeholder;
  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return options ? date.toLocaleDateString(undefined, options) : date.toLocaleString();
  } catch {
    return placeholder;
  }
}
