"use client";

import { usePathname } from "next/navigation";
import { PortalAuthProvider, usePortalAuth } from "@/contexts/PortalAuthContext";
import PortalLayout from "@/components/PortalLayout";

const PUBLIC_PATHS = [
  "/portal/login",
  "/portal/signup",
  "/portal/forgot-password",
  "/portal/reset-password",
  "/portal/accept-invite",
  "/portal/verify-email",
  "/portal/recovery",
];

function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = usePortalAuth();
  const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  if (isPublic) return <>{children}</>;

  return (
    <PortalLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#1A1A2E] animate-spin" />
        </div>
      ) : (
        children
      )}
    </PortalLayout>
  );
}

export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalAuthProvider>
      <PortalShell>{children}</PortalShell>
    </PortalAuthProvider>
  );
}
