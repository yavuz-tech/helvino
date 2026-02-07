"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBanner from "@/components/ErrorBanner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setResetLink(null);

    try {
      const res = await fetch(`${API_URL}/portal/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.status === 429) {
        const retryAfter = data?.error?.retryAfterSec || res.headers.get("retry-after") || "30";
        setError(t("rateLimit.message").replace("{seconds}", String(retryAfter)));
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const msg = typeof data.error === "object" ? data.error.message : data.error;
        setError(msg || t("common.error"));
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      if (data.resetLink) {
        setResetLink(data.resetLink);
      }
    } catch {
      setError(t("common.networkError"));
    } finally {
      setIsLoading(false);
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
          <h1 className="text-3xl font-bold mb-2">{t("security.forgotPasswordTitle")}</h1>
          <p className="text-slate-300">{t("security.forgotPasswordDesc")}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {success ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                {t("security.resetLinkSent")}
              </div>
              {resetLink && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-amber-700 mb-1">{t("security.resetLinkDev")}</p>
                  <a
                    href={resetLink}
                    className="text-xs text-amber-900 font-mono break-all hover:underline"
                  >
                    {resetLink}
                  </a>
                </div>
              )}
              <Link
                href="/portal/login"
                className="block w-full text-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                {t("security.backToLogin")}
              </Link>
            </div>
          ) : (
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

              <button
                type="submit"
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
                disabled={isLoading}
              >
                {isLoading ? t("security.sendingResetLink") : t("security.sendResetLink")}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-slate-400">
          <Link href="/portal/login" className="text-white font-medium hover:underline">
            {t("security.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
