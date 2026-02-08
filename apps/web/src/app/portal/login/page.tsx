"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkPortalAuth, portalLogin } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PasskeyLoginButton from "@/components/PasskeyLoginButton";
import ErrorBanner from "@/components/ErrorBanner";
import { designTokens } from "@/lib/designTokens";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PortalLoginPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    const verify = async () => {
      const user = await checkPortalAuth();
      if (user) router.push("/portal");
    };
    verify();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await portalLogin(email, password);
    if (result.ok) {
      router.push("/portal");
      router.refresh();
      return;
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

    // Check if email verification required (Step 11.36)
    if (result.errorCode === "EMAIL_VERIFICATION_REQUIRED") {
      setEmailVerificationRequired(true);
      setVerificationResent(false);
      setRequestId(result.requestId || null);
      setIsLoading(false);
      return;
    }

    setError(result.error || t("auth.loginFailed"));
    setRequestId(result.requestId || null);
    setIsLoading(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-[#0F3D3D] flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] rounded-2xl items-center justify-center mb-4 shadow-[0_4px_16px_rgba(15,92,92,0.4)]">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{t("nav.customerPortal")}</h1>
          <p className="text-sm text-slate-400">{t("auth.tenantAccess")}</p>
        </div>

        <div className={`bg-white rounded-2xl border border-slate-200/80 p-7 ${designTokens.shadows.elevated}`}>
          {emailVerificationRequired ? (
            /* ── Email Verification Required ── */
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                {t("verifyEmail.title")}
              </h2>

              <ErrorBanner
                message={t("login.emailVerificationRequired")}
                requestId={requestId}
                className="mb-4 text-left"
              />

              {verificationResent ? (
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-sm text-emerald-700 mb-4">
                  {t("login.verificationResent")}
                </div>
              ) : null}

              {error && (
                <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4 text-left" />
              )}

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading || verificationResent}
                className={`w-full ${designTokens.buttons.primary} py-2.5`}
              >
                {resendLoading ? t("common.loading") : t("login.resendVerification")}
              </button>
              <button
                type="button"
                onClick={() => { setEmailVerificationRequired(false); setError(null); setVerificationResent(false); }}
                className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                {t("security.backToLogin")}
              </button>
            </div>
          ) : mfaRequired ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-1.5">
                {t("mfa.loginRequired")}
              </h2>
              <p className="text-sm text-slate-500 mb-5">
                {t("mfa.loginDesc")}
              </p>

              {error && (
                <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />
              )}

              <form onSubmit={handleMfaVerify} className="space-y-4">
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder={t("mfa.codeOrBackup")}
                  className={`${designTokens.inputs.base} font-mono text-center text-lg tracking-widest`}
                  autoFocus
                  disabled={mfaLoading}
                  maxLength={20}
                />
                <button
                  type="submit"
                  className={`w-full ${designTokens.buttons.primary} py-3`}
                  disabled={mfaLoading || !mfaCode.trim()}
                >
                  {mfaLoading ? t("mfa.verifying") : t("mfa.loginVerify")}
                </button>
              </form>
              <button
                onClick={() => { setMfaRequired(false); setMfaCode(""); setError(null); }}
                className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                {t("security.backToLogin")}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-5">
                {t("auth.signIn")}
              </h2>

              {error && (
                <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className={designTokens.inputs.label}>
                    {t("auth.email")}
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={designTokens.inputs.base}
                    placeholder="you@company.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className={designTokens.inputs.label}>
                    {t("auth.password")}
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={designTokens.inputs.base}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full ${designTokens.buttons.primary} py-3`}
                  disabled={isLoading}
                >
                  {isLoading ? t("auth.signingIn") : t("auth.signIn")}
                </button>
              </form>

              {/* Passkey divider + button */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200/80" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400">{t("passkeys.orDivider")}</span>
                </div>
              </div>

              <PasskeyLoginButton
                area="portal"
                email={email}
                onSuccess={() => { router.push("/portal"); router.refresh(); }}
                onError={(msg) => setError(msg)}
              />

              <div className="mt-5 text-center space-y-2">
                <a href="/portal/forgot-password" className="block text-sm text-slate-500 hover:text-slate-900 transition-colors">
                  {t("security.forgotPassword")}
                </a>
                <a href="/signup" className="block text-sm text-slate-500 hover:text-slate-900 transition-colors">
                  {t("signup.submit")}
                </a>
              </div>
            </>
          )}
        </div>

        <div className="mt-5 text-center text-xs text-slate-500">
          {t("auth.internalAdmin")}{" "}
          <a href="/login" className="text-white font-medium hover:underline">
            {t("auth.loginHere")}
          </a>
        </div>
      </div>
    </div>
  );
}
