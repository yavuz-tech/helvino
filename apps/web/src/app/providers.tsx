"use client";

import { DebugProvider } from "@/contexts/DebugContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { StepUpProvider } from "@/contexts/StepUpContext";
import { I18nProvider } from "@/i18n/I18nContext";
import DebugBanner from "@/components/DebugBanner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <StepUpProvider>
        <OrgProvider>
          <DebugProvider>
            {children}
            <DebugBanner />
          </DebugProvider>
        </OrgProvider>
      </StepUpProvider>
    </I18nProvider>
  );
}
