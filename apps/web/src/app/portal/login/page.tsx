"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, ShieldCheck, Sparkles } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { checkPortalAuth, portalLogin, storePortalRefreshToken } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PasskeyLoginButton from "@/components/PasskeyLoginButton";
import ErrorBanner from "@/components/ErrorBanner";
import { premiumToast } from "@/components/PremiumToast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

export default function PortalLoginPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
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
  const [lockedAccount, setLockedAccount] = useState(false);
  const [unlockFormOpen, setUnlockFormOpen] = useState(false);
  const [unlockToken, setUnlockToken] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRenderNonce, setCaptchaRenderNonce] = useState(0);

  const premiumInput =
    "w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 outline-none transition-all focus:border-cyan-300/60 focus:bg-white/15 focus:ring-2 focus:ring-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60";
  const premiumLabel = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300";
  const premiumPrimaryBtn =
    "w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(6,182,212,0.35)] transition-all hover:brightness-110 hover:shadow-[0_12px_30px_rgba(6,182,212,0.45)] disabled:cursor-not-allowed disabled:opacity-60";
  const premiumSecondaryText = "text-sm text-slate-300 transition-colors hover:text-white";

  useEffect(() => {
    const verify = async () => {
      const user = await checkPortalAuth();
      if (user) router.push("/portal");
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

    const result = await portalLogin(email, password, captchaToken || undefined, fingerprintPayload);
    if (result.ok) {
      if (result.showSecurityOnboarding) {
        router.push("/portal/security-onboarding");
      } else {
        router.push("/portal");
      }
      router.refresh();
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
    setError(result.error || t("auth.loginFailed"));
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
        router.push("/portal");
        router.refresh();
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
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
        <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-slate-900">{t("verifyEmail.title")}</h2>

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
        className="mt-3 w-full text-center text-sm text-slate-300 transition-colors hover:text-white"
      >
        {t("security.backToLogin")}
      </button>
    </div>
  ) : mfaRequired ? (
    <>
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
          <KeyRound size={16} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{t("mfa.loginRequired")}</h2>
          <p className="text-sm text-slate-300">{t("mfa.loginDesc")}</p>
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
        className="mt-3 w-full text-center text-sm text-slate-300 transition-colors hover:text-white"
      >
        {t("security.backToLogin")}
      </button>
    </>
  ) : (
    <>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">{t("auth.signIn")}</h2>
        <p className="mt-1 text-sm text-slate-300">{t("portalLogin.formSubtitle")}</p>
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
            <p className="mb-4 rounded-lg border border-white/15 bg-white/10 px-2.5 py-2 text-xs font-mono text-slate-300">
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
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={premiumInput}
            placeholder={t("portalLogin.passwordPlaceholder")}
            required
            disabled={isLoading}
            autoComplete="current-password"
          />
        </div>

        {showCaptcha ? (
          <div>
            <label className={premiumLabel}>{t("portalLogin.captchaLabel")}</label>
            <div className="rounded-xl border border-white/15 bg-white/5 p-2.5">
              {HCAPTCHA_SITE_KEY ? (
                <HCaptcha
                  key={captchaRenderNonce}
                  sitekey={HCAPTCHA_SITE_KEY}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                  theme="dark"
                />
              ) : (
                <p className="text-xs text-amber-300">{t("portalLogin.captchaMissingKey")}</p>
              )}
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          className={premiumPrimaryBtn}
          disabled={isLoading || (showCaptcha && !captchaToken)}
        >
          {isLoading ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      {lockedAccount ? (
        <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-3">
          <p className="text-sm font-medium text-amber-100">{t("portalLogin.accountLocked")}</p>
          <button
            type="button"
            onClick={() => setUnlockFormOpen((v) => !v)}
            className="mt-1 text-xs font-semibold text-amber-200 underline decoration-dotted underline-offset-2 hover:text-amber-50"
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
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="relative z-10 inline-flex items-center rounded-full border border-white/20 bg-slate-900/75 px-3.5 py-1 font-medium uppercase tracking-wide text-slate-200 backdrop-blur-sm">
            {t("passkeys.orDivider")}
          </span>
        </div>
      </div>

      <PasskeyLoginButton
        area="portal"
        email={email}
        className="border-white/20 bg-white/10 text-slate-100 hover:border-cyan-300/60 hover:bg-white/15"
        onSuccess={() => {
          router.push("/portal");
          router.refresh();
        }}
        onError={(msg) => setError(msg)}
      />

      <div className="mt-5 space-y-2 text-center">
        <Link href="/portal/forgot-password" className={`block ${premiumSecondaryText}`}>
          {t("security.forgotPassword")}
        </Link>
        <Link href="/signup" className={`block ${premiumSecondaryText}`}>
          {t("signup.submit")}
        </Link>
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071126] px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(124,58,237,0.26),transparent_44%),radial-gradient(circle_at_88%_82%,rgba(6,182,212,0.22),transparent_45%),linear-gradient(125deg,#08132A_0%,#0B1C3A_48%,#0D2D39_100%)]" />
      <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-center py-6 lg:min-h-[calc(100vh-3rem)] lg:py-0">
        <div className="grid w-full items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <section className="hidden text-white lg:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
              <Sparkles size={14} className="text-amber-300" />
              <span>{t("portalLogin.heroBadge")}</span>
            </div>
            <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight">
              {t("portalLogin.welcomeTitle")}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-200">
              {t("portalLogin.welcomeSubtitle")}
            </p>
            <div className="mt-8 space-y-3">
              {[t("portalLogin.benefitOne"), t("portalLogin.benefitTwo"), t("portalLogin.benefitThree")].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm"
                >
                  <ShieldCheck size={18} className="shrink-0 text-emerald-300" />
                  <span className="text-sm text-white/90">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/80 backdrop-blur-sm">
              <Lock size={14} />
              <span>{t("portalLogin.trustLine")}</span>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[460px]">
            <div className="mb-6 text-center lg:hidden">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] shadow-[0_8px_24px_rgba(15,92,92,0.4)]">
                <span className="text-xl font-bold text-white">H</span>
              </div>
              <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">{t("nav.customerPortal")}</h1>
              <p className="text-sm text-slate-300">{t("auth.tenantAccess")}</p>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-white/30 via-cyan-200/20 to-violet-200/20 p-[1px] shadow-[0_35px_90px_rgba(6,12,24,0.55)]">
              <div className="rounded-3xl border border-white/10 bg-slate-900/55 p-7 backdrop-blur-2xl">
                {cardContent}
              </div>
            </div>

          </section>
        </div>
      </div>
    </div>
  );
}
