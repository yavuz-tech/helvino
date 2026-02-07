"use client";

import { useState } from "react";
import Link from "next/link";
import PublicLayout from "@/components/PublicLayout";
import ErrorBanner from "@/components/ErrorBanner";
import { useI18n } from "@/i18n/I18nContext";
import PasswordStrength from "@/components/PasswordStrength";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function SignupPage() {
  const { t } = useI18n();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRequestId(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/portal/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, email, password }),
      });

      const data = await response.json();
      const rid = data?.requestId || response.headers.get("x-request-id") || null;
      setRequestId(rid);

      if (response.status === 429) {
        const seconds = data?.error?.retryAfterSec || 30;
        setError(t("rateLimit.message").replace("{seconds}", String(seconds)));
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const msg =
          typeof data?.error === "object"
            ? data.error.message
            : data?.error || t("signup.error");
        setError(msg);
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("signup.error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {success ? (
            /* ── Success State ── */
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                {t("signup.successTitle")}
              </h2>
              <p className="text-slate-600 text-sm mb-6">
                {t("signup.successMessage")}
              </p>
              <Link
                href="/portal/login"
                className="inline-flex px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
              >
                {t("signup.loginLink")}
              </Link>
            </div>
          ) : (
            /* ── Signup Form ── */
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">
                {t("signup.title")}
              </h1>
              <p className="text-sm text-slate-500 mb-6">
                {t("signup.subtitle")}
              </p>

              {error && (
                <ErrorBanner
                  message={error}
                  requestId={requestId}
                  onDismiss={() => setError(null)}
                  className="mb-4"
                />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("signup.workspaceName")}
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder={t("signup.workspacePlaceholder")}
                    required
                    minLength={2}
                    maxLength={100}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("signup.email")}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("signup.emailPlaceholder")}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("signup.password")}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("signup.passwordPlaceholder")}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                  />
                  <PasswordStrength password={password} minLength={8} />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? t("signup.submitting") : t("signup.submit")}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                {t("signup.haveAccount")}{" "}
                <Link
                  href="/portal/login"
                  className="text-slate-900 font-medium hover:underline"
                >
                  {t("signup.loginLink")}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
