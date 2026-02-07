"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBanner from "@/components/ErrorBanner";
import PasskeyLoginButton from "@/components/PasskeyLoginButton";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorRequestId(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/internal/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      // Check if MFA required
      if (data.mfaRequired) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const reqId = response.headers.get("x-request-id") || null;
        setErrorRequestId(reqId);

        // Handle rate limiting (429)
        if (response.status === 429) {
          const retryAfter = data?.error?.retryAfterSec || response.headers.get("retry-after") || "30";
          throw new Error(t("rateLimit.message").replace("{seconds}", String(retryAfter)));
        }

        throw new Error(
          (typeof data.error === "object" ? data.error.message : data.error) || `HTTP ${response.status}`
        );
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    setError(null);
    setMfaLoading(true);

    try {
      const response = await fetch(`${API_URL}/internal/auth/mfa/login-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        router.push("/dashboard");
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Helvino</h1>
          <p className="text-slate-600 mt-2">{t("auth.adminDashboard")}</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
          {mfaRequired ? (
            <>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                {t("mfa.loginRequired")}
              </h2>
              <p className="text-sm text-slate-600 mb-6">
                {t("mfa.loginDesc")}
              </p>

              {error && (
                <ErrorBanner message={error} requestId={errorRequestId} className="mb-4" />
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
                  className="w-full py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
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
                <ErrorBanner message={error} requestId={errorRequestId} className="mb-4" />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-900 mb-2">
                    {t("auth.email")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@helvino.io"
                    disabled={loading}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-900 mb-2">
                    {t("auth.password")}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {loading ? t("auth.signingIn") : t("auth.signIn")}
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
                area="admin"
                email={email}
                onSuccess={() => router.push("/dashboard")}
                onError={(msg) => { setError(msg); setErrorRequestId(null); }}
              />

              <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-xs text-slate-500 text-center">
                  {t("auth.defaultCredentials")}
                </p>
                <p className="text-xs text-slate-500 text-center mt-2">
                  {t("auth.changeInProd")}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            {t("auth.adminFooter")} &bull; {t("auth.cookieSession")}
          </p>
        </div>
      </div>
    </div>
  );
}
