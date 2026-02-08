"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  checkPortalAuth,
  portalLogout,
  type PortalUser,
} from "@/lib/portal-auth";

interface PortalAuthContextValue {
  user: PortalUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}

// Pages that don't require authentication
const PUBLIC_PATHS = [
  "/portal/login",
  "/portal/signup",
  "/portal/forgot-password",
  "/portal/reset-password",
  "/portal/accept-invite",
  "/portal/verify-email",
  "/portal/recovery",
];

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  const verify = useCallback(async () => {
    try {
      const portalUser = await checkPortalAuth();
      setUser(portalUser);
      if (!portalUser && !isPublicPath) {
        router.push("/portal/login");
      }
    } catch {
      setUser(null);
      if (!isPublicPath) {
        router.push("/portal/login");
      }
    } finally {
      setLoading(false);
    }
  }, [router, isPublicPath]);

  useEffect(() => {
    verify();
  }, [verify]);

  const logout = useCallback(async () => {
    await portalLogout();
    setUser(null);
    router.push("/portal/login");
  }, [router]);

  const refresh = useCallback(async () => {
    const portalUser = await checkPortalAuth();
    setUser(portalUser);
  }, []);

  return (
    <PortalAuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </PortalAuthContext.Provider>
  );
}
