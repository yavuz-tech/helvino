"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkPortalAuth, portalLogin } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PasskeyLoginButton from "@/components/PasskeyLoginButton";
import ErrorBanner from "@/components/ErrorBanner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PortalLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const seconds = data?.error?.retryAfterSec || 30;
        setError(t("rateLimit.message").replace("{seconds}", String(seconds)));
      } else {
        setVerificationResent(true);
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8 text-white">
          <div className="inline-block w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4">
            <span className="text-slate-900 font-bold text-2xl">H</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{t("nav.customerPortal")}</h1>
          <p className="text-slate-300">{t("auth.tenantAccess")}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          {emailVerificationRequired ? (
            /* ── Email Verification Required ── */
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
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
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 mb-4">
                  {t("login.verificationResent")}
                </div>
              ) : null}

              {error && (
                <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4 text-left" />
              )}

              <button
                onClick={handleResendVerification}
                disabled={resendLoading || verificationResent}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400 text-sm"
              >
                {resendLoading ? t("common.loading") : t("login.resendVerification")}
              </button>
              <button
                onClick={() => { setEmailVerificationRequired(false); setError(null); setVerificationResent(false); }}
                className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                {t("security.backToLogin")}
              </button>
            </div>
          ) : mfaRequired ? (
            <>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                {t("mfa.loginRequired")}
              </h2>
              <p className="text-sm text-slate-600 mb-6">
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-center text-lg tracking-widest"
                  autoFocus
                  disabled={mfaLoading}
                  maxLength={20}
                />
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
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
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                {t("auth.signIn")}
              </h2>

              {error && (
                <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-6" />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                    {t("auth.email")}
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="you@company.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                    {t("auth.password")}
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
                  disabled={isLoading}
                >
                  {isLoading ? t("auth.signingIn") : t("auth.signIn")}
                </button>
              </form>

              {/* Passkey divider + button */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
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

              <div className="mt-4 text-center space-y-2">
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

        <div className="mt-6 text-center text-sm text-slate-400">
          {t("auth.internalAdmin")}{" "}
          <a href="/login" className="text-white font-medium hover:underline">
            {t("auth.loginHere")}
          </a>
        </div>
      </div>
    </div>
  );
}
