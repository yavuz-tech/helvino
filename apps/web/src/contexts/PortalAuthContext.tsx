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
  isPortalOnboardingDeferredForSession,
  portalLogout,
  type PortalUser,
} from "@/lib/portal-auth";
import { useAuth } from "@/hooks/useAuth";

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
  "/portal/mfa-setup",
  "/portal/security-onboarding",
];

const ONBOARDING_EXEMPT_PATHS = [
  "/portal/security-onboarding",
  "/portal/mfa-setup",
  "/portal/login",
];

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));
  const isOnboardingExemptPath = ONBOARDING_EXEMPT_PATHS.some((p) => pathname?.startsWith(p));

  const shouldForceSecurityOnboarding = useCallback(
    (portalUser: PortalUser | null) =>
      Boolean(portalUser?.showSecurityOnboarding) &&
      !isPortalOnboardingDeferredForSession() &&
      Boolean(pathname?.startsWith("/portal")) &&
      !isOnboardingExemptPath,
    [pathname, isOnboardingExemptPath]
  );

  const hardRedirectToOnboarding = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.replace("/portal/security-onboarding");
      return;
    }
    router.replace("/portal/security-onboarding");
  }, [router]);

  const verify = useCallback(async () => {
    try {
      const portalUser = await checkPortalAuth();
      setUser(portalUser);
      if (shouldForceSecurityOnboarding(portalUser)) {
        hardRedirectToOnboarding();
        return;
      }
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
  }, [router, isPublicPath, shouldForceSecurityOnboarding, hardRedirectToOnboarding]);

  useEffect(() => {
    verify();
  }, [verify]);

  // Global hard-guard: if onboarding is required, keep user on onboarding flow.
  useEffect(() => {
    if (loading) return;
    if (shouldForceSecurityOnboarding(user)) {
      hardRedirectToOnboarding();
    }
  }, [loading, user, router, shouldForceSecurityOnboarding, hardRedirectToOnboarding]);

  // Fail-safe: never keep portal UI in infinite loading state.
  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => {
      setLoading(false);
      if (!user && !isPublicPath) {
        router.push("/portal/login");
      }
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [loading, user, isPublicPath, router]);

  useAuth({
    enabled: Boolean(user),
    onRefreshFailed: () => {
      setUser(null);
      if (!isPublicPath) {
        router.push("/portal/login");
      }
    },
  });

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
