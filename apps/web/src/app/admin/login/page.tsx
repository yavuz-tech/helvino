"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBanner from "@/components/ErrorBanner";
import PasskeyLoginButton from "@/components/PasskeyLoginButton";
import TurnstileWidget from "@/components/TurnstileWidget";
import HelvionLogo from "@/components/brand/HelvionLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

function readErrorPayload(data: unknown): { code: string | null; message: string | null; retryAfterSec: number | null } {
  if (!data || typeof data !== "object") return { code: null, message: null, retryAfterSec: null };
  const asRecord = data as { error?: unknown };
  if (typeof asRecord.error === "string") {
    return { code: null, message: asRecord.error, retryAfterSec: null };
  }
  if (asRecord.error && typeof asRecord.error === "object") {
    const e = asRecord.error as { code?: unknown; message?: unknown; retryAfterSec?: unknown };
    return {
      code: typeof e.code === "string" ? e.code : null,
      message: typeof e.message === "string" ? e.message : null,
      retryAfterSec: typeof e.retryAfterSec === "number" ? e.retryAfterSec : null,
    };
  }
  return { code: null, message: null, retryAfterSec: null };
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRenderNonce, setCaptchaRenderNonce] = useState(0);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setErrorRequestId(null);
    setLoading(true);

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
      // best effort only
    }

    try {
      const response = await fetch(`${API_URL}/internal/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          locale,
          ...(captchaToken ? { captchaToken } : {}),
          ...fingerprintPayload,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const parsed = readErrorPayload(data);

      if (data?.mfaRequired) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setErrorRequestId(response.headers.get("x-request-id") || null);

        if (response.status === 429 || parsed.code === "RATE_LIMITED") {
          const waitSec = parsed.retryAfterSec || Number(response.headers.get("retry-after") || "30");
          setError(t("rateLimit.message").replace("{seconds}", String(waitSec || 30)));
          setLoading(false);
          return;
        }

        if (parsed.code === "CAPTCHA_REQUIRED") {
          setShowCaptcha(true);
          setCaptchaToken(null);
          setCaptchaRenderNonce((v) => v + 1);
          setError(t("portalLogin.captchaRequired"));
          setLoading(false);
          return;
        }

        if (parsed.code === "INVALID_CAPTCHA") {
          setShowCaptcha(true);
          setCaptchaToken(null);
          setCaptchaRenderNonce((v) => v + 1);
          setError(t("portalLogin.invalidCaptcha"));
          setLoading(false);
          return;
        }

        if (parsed.code === "ACCOUNT_LOCKED") {
          setError(t("adminAuth.accountLocked"));
          setLoading(false);
          return;
        }

        if (parsed.code === "MFA_REQUIRED_ADMIN") {
          setError(t("mfaPolicy.adminRequiredDesc"));
          setLoading(false);
          return;
        }

        if (parsed.code === "DEVICE_LIMIT_REACHED") {
          setError(t("adminAuth.deviceLimitReached"));
          setLoading(false);
          return;
        }

        setError(parsed.message || t("auth.invalidCredentials"));
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!mfaCode.trim()) return;
    setError(null);
    setMfaLoading(true);

    try {
      const response = await fetch(`${API_URL}/internal/auth/mfa/login-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      const parsed = readErrorPayload(data);

      if (response.ok && data.ok) {
        router.push("/dashboard");
        return;
      }
      setError(parsed.message || t("mfa.invalidCode"));
    } catch {
      setError(t("common.networkError"));
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden font-[var(--font-body)] px-4 py-6 sm:px-6 lg:px-8"
      style={{
        background:
          "radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(251, 113, 133, 0.15), transparent 50%), linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
      }}
    >
      <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-24 h-72 w-72 rounded-full bg-rose-300/25 blur-3xl" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-center py-6 lg:min-h-[calc(100vh-3rem)] lg:py-0">
        <div className="grid w-full items-center gap-8 lg:grid-cols-5 lg:gap-12">
          <section className="hidden lg:col-span-2 lg:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/60 px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] backdrop-blur-sm">
              <Sparkles size={14} className="text-[var(--accent)]" />
              <span>{t("auth.adminDashboard")}</span>
            </div>
            <h1 className="max-w-xl font-[var(--font-heading)] text-4xl font-bold leading-[1.1] tracking-tight text-[var(--text-primary)]">
              {t("mfaPolicy.adminRequired")}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--text-secondary)]">
              {t("mfaPolicy.adminRequiredDesc")}
            </p>
            <div className="mt-8 space-y-3">
              {[t("portalLogin.benefitOne"), t("portalLogin.benefitTwo"), t("portalLogin.benefitThree")].map((item) => (
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

          <section className="mx-auto w-full max-w-[560px] lg:col-span-3">
            <div className="rounded-3xl bg-gradient-to-br from-amber-300/55 via-rose-200/45 to-amber-100/65 p-[1px] shadow-[0_30px_80px_rgba(149,115,22,0.25)]">
              <div className="rounded-3xl border border-amber-100/80 bg-[var(--bg-glass)] p-7 backdrop-blur-2xl">
                <div className="mb-6 flex flex-col items-center justify-center text-center">
                  <HelvionLogo variant="light" heightClassName="h-14 sm:h-16" className="hv-logo-float" />
                </div>

                {error ? (
                  <ErrorBanner message={error} requestId={errorRequestId} className="mb-4" />
                ) : null}

                {mfaRequired ? (
                  <>
                    <h2 className="mb-1.5 font-[var(--font-heading)] text-lg font-semibold text-[var(--text-primary)]">
                      {t("mfa.loginRequired")}
                    </h2>
                    <p className="mb-5 text-sm text-[var(--text-secondary)]">{t("mfa.loginDesc")}</p>
                    <form onSubmit={handleMfaVerify} className="space-y-4">
                      <input
                        type="text"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder={t("mfa.codeOrBackup")}
                        className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-center font-mono text-lg tracking-widest text-[var(--text-primary)] outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                        autoFocus
                        disabled={mfaLoading}
                        maxLength={20}
                      />
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105 disabled:opacity-60"
                        disabled={mfaLoading || !mfaCode.trim()}
                      >
                        {mfaLoading ? t("mfa.verifying") : t("mfa.loginVerify")}
                      </button>
                    </form>
                    <button
                      type="button"
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
                    <h2 className="mb-5 text-center font-[var(--font-heading)] text-lg font-semibold text-[var(--text-primary)]">{t("auth.signIn")}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          {t("auth.email")}
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="email"
                          placeholder={t("portalLogin.emailPlaceholder")}
                          disabled={loading}
                          className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          {t("auth.password")}
                        </label>
                        <input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                          placeholder={t("portalLogin.passwordPlaceholder")}
                          disabled={loading}
                          className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
                        />
                      </div>

                      {showCaptcha ? (
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                            {t("portalLogin.captchaLabel")}
                          </label>
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
                        disabled={loading || (showCaptcha && !captchaToken)}
                        className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105 disabled:opacity-60"
                      >
                        {loading ? t("auth.signingIn") : t("auth.signIn")}
                      </button>
                    </form>

                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-amber-200/80" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="relative z-10 inline-flex items-center rounded-full border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-1 font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                          {t("passkeys.orDivider")}
                        </span>
                      </div>
                    </div>

                    <PasskeyLoginButton
                      area="admin"
                      email={email}
                      className="border-amber-200/70 bg-[var(--bg-glass)] text-[var(--text-primary)] hover:border-amber-300 hover:bg-white/90"
                      onSuccess={() => router.push("/dashboard")}
                      onError={(msg) => {
                        setError(msg);
                        setErrorRequestId(null);
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
