"use client";

import { useEffect } from "react";
import { DebugProvider } from "@/contexts/DebugContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { StepUpProvider } from "@/contexts/StepUpContext";
import { I18nProvider } from "@/i18n/I18nContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import DebugBanner from "@/components/DebugBanner";
import PremiumToastProvider from "@/components/PremiumToast";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DebugGate() {
  const searchParams = useSearchParams();
  const showDebug = process.env.NODE_ENV !== "production" && searchParams.get("debug") === "1";
  if (!showDebug) return null;
  return <DebugBanner />;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const isGenericEventPayload = (value: unknown): boolean => {
      if (typeof value === "string") {
        const normalized = value.trim();
        return normalized === "[object Event]" || normalized === "[object Object]" || normalized === "Event";
      }
      if (!value || typeof value !== "object") return false;
      if (value instanceof Event) return true;
      const asRecord = value as { message?: unknown; type?: unknown };
      // Real Error objects should not be swallowed.
      if (typeof asRecord.message === "string" && asRecord.message.trim().length > 0) return false;
      return typeof asRecord.type === "string";
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isGenericEventPayload(event.reason)) {
        event.preventDefault();
        console.warn("[runtime] Suppressed generic Event rejection:", event.reason);
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (isGenericEventPayload(event.error) || isGenericEventPayload(event.message)) {
        event.preventDefault();
        console.warn("[runtime] Suppressed generic Event error:", event.error ?? event.message);
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, []);

  return (
    <I18nProvider>
      <CurrencyProvider>
        <StepUpProvider>
          <OrgProvider>
            <DebugProvider>
              {children}
              <PremiumToastProvider />
              <Suspense fallback={null}>
                <DebugGate />
              </Suspense>
            </DebugProvider>
          </OrgProvider>
        </StepUpProvider>
      </CurrencyProvider>
    </I18nProvider>
  );
}
