"use client";

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
