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
  const verifyCalledRef = useRef(false);
  const consecutiveFailsRef = useRef(0);

  useEffect(() => {
    pathnameRef.current = pathname || "";
  }, [pathname]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  const shouldForceSecurityOnboarding = useCallback(
    (portalUser: PortalUser | null) => {
      const currentPath = pathnameRef.current || pathname || "";
      const isOnboardingExempt = ONBOARDING_EXEMPT_PATHS.some((p) => currentPath.startsWith(p));
      return (
        Boolean(portalUser?.showSecurityOnboarding) &&
        !isPortalOnboardingDeferredForSession() &&
        currentPath.startsWith("/portal") &&
        !isOnboardingExempt
      );
    },
    [pathname]
  );

  const hardRedirectToOnboarding = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.replace("/portal/security-onboarding");
      return;
    }
    router.replace("/portal/security-onboarding");
  }, [router]);

  // verify runs ONCE on mount, not on every route change
  const verify = useCallback(async () => {
    try {
      const portalUser = await checkPortalAuth();
      const hadUser = Boolean(userRef.current);
      const currentPath = pathnameRef.current || "";
      const isPublicNow = PUBLIC_PATHS.some((p) => currentPath.startsWith(p));

      if (portalUser) {
        setUser(portalUser);
        consecutiveFailsRef.current = 0;
      } else if (!isPublicNow && !hadUser) {
        // Only redirect to login if we never had a user
        consecutiveFailsRef.current++;
        if (consecutiveFailsRef.current >= 2) {
          setUser(null);
          router.push("/portal/login");
        }
        // First fail: don't redirect yet, might be a transient hiccup
      }
      // If hadUser and portalUser is null, keep existing user (transient failure)

      if (portalUser && shouldForceSecurityOnboarding(portalUser)) {
        hardRedirectToOnboarding();
        return;
      }
    } catch {
      const hadUser = Boolean(userRef.current);
      const currentPath = pathnameRef.current || "";
      const isPublicNow = PUBLIC_PATHS.some((p) => currentPath.startsWith(p));
      if (!isPublicNow && !hadUser) {
        consecutiveFailsRef.current++;
        if (consecutiveFailsRef.current >= 2) {
          setUser(null);
          router.push("/portal/login");
        }
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Run verify ONCE on mount — not on every pathname change
  useEffect(() => {
    if (verifyCalledRef.current) return;
    verifyCalledRef.current = true;
    verify();
  }, [verify]);

  // Global hard-guard: if onboarding is required, keep user on onboarding flow.
  useEffect(() => {
    if (loading) return;
    if (shouldForceSecurityOnboarding(user)) {
      hardRedirectToOnboarding();
    }
  }, [loading, user, shouldForceSecurityOnboarding, hardRedirectToOnboarding]);

  // Fail-safe: never keep portal UI in infinite loading state.
  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [loading]);

  useAuth({
    enabled: Boolean(user),
    onRefreshFailed: () => {
      // Don't immediately redirect — the user might still have a valid httpOnly cookie.
      // Only clear user if a subsequent verify also fails.
      consecutiveFailsRef.current++;
      if (consecutiveFailsRef.current >= 2 && !isPublicPath) {
        setUser(null);
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
