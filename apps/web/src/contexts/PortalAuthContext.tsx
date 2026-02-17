"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
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
  const pathnameRef = useRef<string>("");
  const userRef = useRef<PortalUser | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname || "";
  }, [pathname]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
      // Avoid redirect flicker while navigating: if we already have a user and a
      // single auth check returns null (network hiccup / cookie race), keep the
      // existing session and don't bounce to /portal/login.
      const hadUser = Boolean(userRef.current);
      const currentPath = pathnameRef.current || pathname || "";
      const isPublicNow = PUBLIC_PATHS.some((p) => currentPath.startsWith(p));

      if (portalUser) {
        setUser(portalUser);
      } else if (!portalUser && !isPublicNow && !hadUser) {
        setUser(null);
        router.push("/portal/login");
      }
      if (shouldForceSecurityOnboarding(portalUser)) {
        hardRedirectToOnboarding();
        return;
      }
    } catch {
      const hadUser = Boolean(userRef.current);
      const currentPath = pathnameRef.current || pathname || "";
      const isPublicNow = PUBLIC_PATHS.some((p) => currentPath.startsWith(p));
      if (!isPublicNow && !hadUser) {
        setUser(null);
        router.push("/portal/login");
      }
    } finally {
      setLoading(false);
    }
  }, [router, pathname, shouldForceSecurityOnboarding, hardRedirectToOnboarding]);

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
      // Do NOT redirect here. A slow auth check can cause a "login → portal"
      // flicker during navigation. The verify() flow handles redirects when
      // we're confidently unauthenticated.
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [loading]);

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
