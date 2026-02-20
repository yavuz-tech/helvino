"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import {
  checkPortalAuth,
  portalLogin,
  portalLogout,
  storePortalRefreshToken,
} from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PasskeyLoginButton from "@/components/PasskeyLoginButton";
import ErrorBanner from "@/components/ErrorBanner";
import { premiumToast } from "@/components/PremiumToast";
import TurnstileWidget from "@/components/TurnstileWidget";
import HelvionMark from "@/components/brand/HelvionMark";
import {
  mountPublicWidgetScript,
  resolvePublicWidgetIdentity,
} from "@/lib/public-widget";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export default function PortalLoginPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const reauthHandledRef = useRef(false);
  const widgetLoadedRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showNetworkHint, setShowNetworkHint] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  // Email verification state
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);
  const [verificationResent, setVerificationResent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);
  const verifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lockedAccount, setLockedAccount] = useState(false);
  const [unlockFormOpen, setUnlockFormOpen] = useState(false);
  const [unlockToken, setUnlockToken] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRenderNonce, setCaptchaRenderNonce] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const premiumInput =
    "w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60";
  const premiumLabel =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]";
  const premiumPrimaryBtn =
    "w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105 hover:shadow-[0_14px_32px_rgba(245,158,11,0.42)] disabled:cursor-not-allowed disabled:opacity-60";
  const premiumSecondaryText =
    "text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--highlight)]";

  useEffect(() => {
    const verify = async () => {
      const forceReauth = new URLSearchParams(window.location.search).get("reauth") === "1";
      if (forceReauth && !reauthHandledRef.current) {
        reauthHandledRef.current = true;
        await portalLogout();
        return;
      }
      const user = await checkPortalAuth();
      if (!user) return;
      if (user.showSecurityOnboarding) {
        window.location.replace("/portal/security-onboarding");
        return;
      }
      window.location.replace("/portal");
    };
    verify();
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emergencyLockToken = params.get("emergencyLockToken");
    if (!emergencyLockToken) return;
    fetch(`${API_URL}/portal/auth/emergency-lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: emergencyLockToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          premiumToast.error({
            title: t("portalLogin.unlockErrorTitle"),
            description: t("portalLogin.unlockErrorGeneric"),
          });
          return;
        }
        premiumToast.success({
          title: t("portalLogin.unlockSuccessTitle"),
          description: t("portalLogin.accountLocked"),
        });
      })
      .catch(() => {
        premiumToast.error({
          title: t("portalLogin.unlockErrorTitle"),
          description: t("portalLogin.unlockErrorGeneric"),
        });
      });
  }, [t]);

  useEffect(() => {
    if (widgetLoadedRef.current) return;
    widgetLoadedRef.current = true;
    (window as unknown as { HELVINO_WIDGET_CONTEXT?: string }).HELVINO_WIDGET_CONTEXT = "portal-login";
    const identity = resolvePublicWidgetIdentity();
    // Widget-v2 loader requires siteId; avoid mounting script without it.
    if (identity.siteId) {
      mountPublicWidgetScript(identity);
    }
    return () => {
      (window as unknown as { HELVINO_WIDGET_CONTEXT?: string }).HELVINO_WIDGET_CONTEXT = undefined;
    };
  }, []);

  // ─── Auto-poll verification status when email verification is required ───
  useEffect(() => {
    if (!emailVerificationRequired || !email) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/portal/auth/verification-status`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.verified) {
          if (verifyPollRef.current) clearInterval(verifyPollRef.current);
          setAutoChecking(true);
          // Auto-login
          const result = await portalLogin(email.trim().toLowerCase(), password, locale);
          if (result.ok) {
            if (result.refreshToken) storePortalRefreshToken(result.refreshToken);
            window.location.href = "/portal";
            return;
          }
          // MFA needed — let user handle it
          if (result.errorCode === "MFA_REQUIRED") {
            setAutoChecking(false);
            setEmailVerificationRequired(false);
            // Re-trigger login to enter MFA flow
            const mfaResult = await portalLogin(email.trim().toLowerCase(), password, locale);
            if (mfaResult.mfaRequired && mfaResult.mfaToken) {
              setMfaRequired(true);
              setMfaToken(mfaResult.mfaToken);
            }
            return;
          }
          // Fallback
          setAutoChecking(false);
          setEmailVerificationRequired(false);
        }
      } catch {
        // Swallow polling errors
      }
    };

    void poll();
    verifyPollRef.current = setInterval(poll, 3000);

    return () => {
      if (verifyPollRef.current) clearInterval(verifyPollRef.current);
    };
  }, [emailVerificationRequired, email, password, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setLockedAccount(false);

    let fingerprintPayload: { fingerprint?: string; deviceId?: string; deviceName?: string } = {};
    try {
      const fp = await FingerprintJS.load();
      const fpData = await fp.get();
      const ua = navigator.userAgent || "Unknown device";
      fingerprintPayload = {
        fingerprint: fpData.visitorId,
        deviceId: fpData.visitorId,
        deviceName: ua.slice(0, 120),
      };
    } catch {
      // fingerprint is best-effort
    }

    const result = await portalLogin(email, password, captchaToken || undefined, fingerprintPayload, locale);
    if (result.ok) {
      if (result.showSecurityOnboarding) {
        // CRITICAL: No code after this line. router.refresh() was racing
        // with window.location and cancelling the navigation.
        window.location.href = "/portal/security-onboarding";
        return;
      }
      window.location.href = "/portal";
      return;
    }

    if (result.loginAttempts && result.loginAttempts >= 3) {
      setShowCaptcha(true);
    }

    // Handle rate limiting (429)
    if (result.isRateLimited) {
      setError(t("rateLimit.message").replace("{seconds}", String(result.retryAfterSec || 30)));
      setIsLoading(false);
      return;
    }

    // Check if MFA required
    if (result.mfaRequired && result.mfaToken) {
      setMfaRequired(true);
      setMfaToken(result.mfaToken);
      setIsLoading(false);
      return;
    }

    if (result.errorCode === "MFA_SETUP_REQUIRED") {
      const setupToken = result.mfaSetupToken;
      if (setupToken) {
        router.push(`/portal/mfa-setup?setupToken=${encodeURIComponent(setupToken)}`);
      } else {
        router.push("/portal/mfa-setup");
      }
      return;
    }

    // Check if email verification required (Step 11.36)
    if (result.errorCode === "EMAIL_VERIFICATION_REQUIRED") {
      setEmailVerificationRequired(true);
      setVerificationResent(false);
      setRequestId(result.requestId || null);
      setIsLoading(false);
      return;
    }

    if (result.statusCode === 423) {
      setLockedAccount(true);
      setUnlockFormOpen(false);
      setUnlockToken("");
      setError(t("portalLogin.accountLocked"));
      setIsLoading(false);
      return;
    }

    if (result.errorCode === "CAPTCHA_REQUIRED") {
      setShowCaptcha(true);
      setCaptchaToken(null);
      setCaptchaRenderNonce((v) => v + 1);
      setError(t("portalLogin.captchaRequired"));
      setIsLoading(false);
      return;
    }

    if (result.errorCode === "INVALID_CAPTCHA") {
      setShowCaptcha(true);
      setCaptchaToken(null);
      setCaptchaRenderNonce((v) => v + 1);
      setError(t("portalLogin.invalidCaptcha"));
      setIsLoading(false);
      return;
    }

    if (result.errorCode === "NETWORK_ERROR") {
      setError(t("auth.networkError"));
      setShowNetworkHint(true);
      setRequestId(null);
      setIsLoading(false);
      return;
    }
    setShowNetworkHint(false);
    // Map known API error strings to frontend i18n keys for consistent localization
    const apiError = result.error || "";
    const knownErrorMap: Record<string, Parameters<typeof t>[0]> = {
      "Invalid email or password": "auth.invalidCredentials",
      "Geçersiz e-posta veya şifre": "auth.invalidCredentials",
      "Correo o contraseña incorrectos": "auth.invalidCredentials",
      "Account locked": "portalLogin.accountLocked",
      "Login failed": "auth.loginFailed",
    };
    const mappedKey = knownErrorMap[apiError];
    setError(mappedKey ? t(mappedKey) : (apiError || t("auth.loginFailed")));
    setRequestId(result.requestId || null);
    setIsLoading(false);
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = unlockToken.trim();
    if (!token) {
      premiumToast.error({
        title: t("portalLogin.unlockErrorTitle"),
        description: t("portalLogin.unlockTokenRequired"),
      });
      return;
    }

    setUnlockLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/auth/unlock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorCode = typeof data?.error === "object" ? data.error?.code : undefined;
        let msg = t("portalLogin.unlockErrorGeneric");
        if (errorCode === "UNLOCK_TOKEN_EXPIRED") msg = t("portalLogin.unlockErrorExpired");
        if (errorCode === "UNLOCK_TOKEN_USED") msg = t("portalLogin.unlockErrorUsed");
        if (errorCode === "UNLOCK_TOKEN_INVALID") msg = t("portalLogin.unlockErrorInvalid");
        if (errorCode === "TOKEN_REQUIRED") msg = t("portalLogin.unlockTokenRequired");
        premiumToast.error({
          title: t("portalLogin.unlockErrorTitle"),
          description: msg,
        });
        return;
      }

      setLockedAccount(false);
      setUnlockFormOpen(false);
      setUnlockToken("");
      setError(null);
      premiumToast.success({
        title: t("portalLogin.unlockSuccessTitle"),
        description: t("portalLogin.unlockSuccessDesc"),
      });
    } catch {
      premiumToast.error({
        title: t("portalLogin.unlockErrorTitle"),
        description: t("portalLogin.unlockErrorGeneric"),
      });
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/portal/auth/resend-verification`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const seconds = data?.error?.retryAfterSec || 30;
        setError(t("rateLimit.message").replace("{seconds}", String(seconds)));
      } else if (res.ok) {
        setVerificationResent(true);
      } else {
        const msg = typeof data?.error === "object" ? data.error?.message : data?.error;
        setError(msg || t("common.error"));
      }
    } catch {
      setError(t("common.error"));
    } finally {
      setResendLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    setError(null);
    setMfaLoading(true);

    try {
      const res = await fetch(`${API_URL}/portal/auth/mfa/login-verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim(), mfaToken }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        if (data.refreshToken) {
          storePortalRefreshToken(data.refreshToken);
        }
        window.location.href = "/portal";
        return;
      }

      setError(data.error || t("mfa.invalidCode"));
    } catch {
      setError(t("common.networkError"));
    } finally {
      setMfaLoading(false);
    }
  };

  const cardContent = emailVerificationRequired ? (
    <div className="text-center">
      {autoChecking ? (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
            <svg className="h-7 w-7 animate-spin text-emerald-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">{t("signup.verifiedRedirecting")}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{t("signup.pleaseWait")}</p>
        </>
      ) : (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
            <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">{t("verifyEmail.title")}</h2>

          {/* Auto-checking indicator */}
          <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
            <svg className="h-4 w-4 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{t("signup.autoCheckingStatus")}</span>
          </div>

          <ErrorBanner
            message={t("login.emailVerificationRequired")}
            requestId={requestId}
            className="mb-4 text-left"
          />

          {verificationResent ? (
            <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50 p-3 text-sm text-emerald-700">
              {t("login.verificationResent")}
            </div>
          ) : null}

          {error ? (
            <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4 text-left" />
          ) : null}

          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendLoading || verificationResent}
            className={premiumPrimaryBtn}
          >
            {resendLoading ? t("common.loading") : t("login.resendVerification")}
          </button>
          <button
            type="button"
            onClick={() => {
              setEmailVerificationRequired(false);
              setError(null);
              setVerificationResent(false);
            }}
            className="mt-3 w-full text-center text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--highlight)]"
          >
            {t("security.backToLogin")}
          </button>
        </>
      )}
    </div>
  ) : mfaRequired ? (
    <>
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <KeyRound size={16} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("mfa.loginRequired")}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{t("mfa.loginDesc")}</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" /> : null}

      <form onSubmit={handleMfaVerify} className="space-y-4">
        <input
          type="text"
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value)}
          placeholder={t("mfa.codeOrBackup")}
          className={`${premiumInput} font-mono text-center text-lg tracking-widest`}
          autoFocus
          disabled={mfaLoading}
          maxLength={20}
        />
        <button
          type="submit"
          className={premiumPrimaryBtn}
          disabled={mfaLoading || !mfaCode.trim()}
        >
          {mfaLoading ? t("mfa.verifying") : t("mfa.loginVerify")}
        </button>
      </form>
      <button
        onClick={() => {
          setMfaRequired(false);
          setMfaCode("");
          setError(null);
        }}
        className="mt-3 w-full text-center text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--highlight)]"
      >
        {t("security.backToLogin")}
      </button>
    </>
  ) : (
    <>
      <div className="mb-5 text-center">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("auth.signIn")}</h2>
      </div>

      {error ? (
        <>
          <ErrorBanner
            message={error}
            onDismiss={() => {
              setError(null);
              setShowNetworkHint(false);
            }}
            className="mb-4"
          />
          {showNetworkHint ? (
            <p className="mb-4 rounded-lg border border-amber-200/70 bg-[var(--bg-glass)] px-2.5 py-2 text-xs font-mono text-[var(--text-secondary)]">
              {t("auth.networkErrorHint")}
            </p>
          ) : null}
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={premiumLabel}>
            {t("auth.email")}
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={premiumInput}
            placeholder={t("portalLogin.emailPlaceholder")}
            required
            disabled={isLoading}
            autoComplete="email"
            spellCheck={false}
          />
        </div>

        <div>
          <label htmlFor="password" className={premiumLabel}>
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${premiumInput} pr-10`}
              placeholder={t("portalLogin.passwordPlaceholder")}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {showCaptcha ? (
          <div>
            <label className={premiumLabel}>{t("portalLogin.captchaLabel")}</label>
            <div className="rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] p-2.5">
              {TURNSTILE_SITE_KEY ? (
                <TurnstileWidget
                  key={captchaRenderNonce}
                  siteKey={TURNSTILE_SITE_KEY}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              ) : (
                <p className="text-xs text-amber-700">{t("portalLogin.captchaMissingKey")}</p>
              )}
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          className={premiumPrimaryBtn}
          disabled={isLoading}
        >
          {isLoading ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      {lockedAccount ? (
        <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/80 px-3 py-3">
          <p className="text-sm font-medium text-amber-800">{t("portalLogin.accountLocked")}</p>
          <button
            type="button"
            onClick={() => setUnlockFormOpen((v) => !v)}
            className="mt-1 text-xs font-semibold text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-900"
          >
            {t("portalLogin.unlockLink")}
          </button>

          {unlockFormOpen ? (
            <form onSubmit={handleUnlock} className="mt-3 space-y-2">
              <label htmlFor="unlock-token" className={premiumLabel}>
                {t("portalLogin.unlockTokenLabel")}
              </label>
              <input
                id="unlock-token"
                type="text"
                value={unlockToken}
                onChange={(e) => setUnlockToken(e.target.value)}
                className={premiumInput}
                placeholder={t("portalLogin.unlockTokenPlaceholder")}
                disabled={unlockLoading}
              />
              <button type="submit" className={premiumPrimaryBtn} disabled={unlockLoading}>
                {unlockLoading ? t("common.loading") : t("portalLogin.unlockSubmit")}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-amber-200/80" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="relative z-10 inline-flex items-center rounded-full border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-1 font-medium uppercase tracking-wide text-[var(--text-secondary)] backdrop-blur-sm">
            {t("passkeys.orDivider")}
          </span>
        </div>
      </div>

      <PasskeyLoginButton
        area="portal"
        email={email}
        className="border-amber-200/70 bg-[var(--bg-glass)] text-[var(--text-primary)] hover:border-amber-300 hover:bg-white/90"
        onSuccess={(result) => {
          if (result?.showSecurityOnboarding) {
            window.location.href = "/portal/security-onboarding";
            return;
          }
          window.location.href = "/portal";
        }}
        onError={(msg) => setError(msg)}
      />

      <div className="mt-5 space-y-2 text-center">
        <Link
          href="/portal/forgot-password"
          className="block text-sm font-semibold text-[var(--highlight)] transition-colors hover:opacity-80"
        >
          {t("security.forgotPassword")}
        </Link>
        <Link href="/signup" className={`block ${premiumSecondaryText}`}>
          {t("signup.submit")}
        </Link>
      </div>
    </>
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8"
      style={{
        background:
          "linear-gradient(135deg, #FFFBF5 0%, #FFF7ED 50%, #FEF3E2 100%)",
      }}
    >
      <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-24 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-center py-6 md:min-h-[calc(100vh-3rem)] md:py-0">
        <div className="flex w-full items-center gap-8 md:flex-row md:justify-between md:gap-12">
          <section className="hidden w-1/2 md:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/60 px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] backdrop-blur-sm">
              <Sparkles size={14} className="text-[var(--accent)]" />
              <span>{t("portalLogin.heroBadge")}</span>
            </div>
            <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight text-[var(--text-primary)]">
              {t("portalLogin.welcomeTitle")}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--text-secondary)]">
              {t("portalLogin.welcomeSubtitle")}
            </p>
            <div className="mt-8 space-y-3">
              {[t("portalLogin.benefitOne"), t("portalLogin.benefitTwo"), t("portalLogin.benefitThree"), t("portalLogin.trustLine")].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-amber-200/70 bg-white/65 px-4 py-3 backdrop-blur-sm"
                >
                  <ShieldCheck size={18} className="shrink-0 text-[var(--accent)]" />
                  <span className="text-sm text-[var(--text-primary)]">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-[560px] md:w-1/2">
            <div className="mb-6 text-center md:hidden">
              <div className="mx-auto mb-4 inline-flex items-center justify-center">
                <HelvionMark height={58} variant="dark" className="hv-logo-float" />
              </div>
              <h1 className="mb-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{t("nav.customerPortal")}</h1>
              <p className="text-sm text-[var(--text-secondary)]">{t("auth.tenantAccess")}</p>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-amber-300/55 via-rose-200/45 to-amber-100/65 p-[1px] shadow-[0_30px_80px_rgba(149,115,22,0.25)]">
              <div className="rounded-3xl border border-amber-100/80 bg-[var(--bg-glass)] p-7 backdrop-blur-2xl">
                <div className="mb-6 flex flex-col items-center justify-center text-center">
                  <HelvionMark height={62} variant="dark" className="hv-logo-float" />
                </div>
                {cardContent}
              </div>
            </div>

          </section>
        </div>
      </div>
    </div>
  );
}
