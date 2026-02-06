"use client";

import { DebugProvider } from "@/contexts/DebugContext";
import { OrgProvider } from "@/contexts/OrgContext";
import DebugBanner from "@/components/DebugBanner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <DebugProvider>
        {children}
        <DebugBanner />
      </DebugProvider>
    </OrgProvider>
  );
}
