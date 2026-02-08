"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBanner from "@/components/ErrorBanner";
import PasswordStrength from "@/components/PasswordStrength";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function ResetPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const expires = searchParams.get("expires") || "";
  const sig = searchParams.get("sig") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError(t("security.passwordMinLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("security.passwordMismatch"));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/portal/auth/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, ...(expires && sig ? { expires, sig } : {}) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("security.invalidResetToken"));
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/portal");
      }, 2000);
    } catch {
      setError(t("common.networkError"));
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          {t("security.invalidResetToken")}
        </div>
        <Link
          href="/portal/login"
          className="block w-full text-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          {t("security.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
          {t("security.passwordResetSuccess")}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-2">
              {t("security.newPassword")}
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="••••••••"
              required
              disabled={isLoading}
              minLength={8}
            />
            <PasswordStrength password={newPassword} minLength={8} />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
              {t("security.confirmNewPassword")}
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="••••••••"
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
            disabled={isLoading}
          >
            {isLoading ? t("security.resettingPassword") : t("security.resetPassword")}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();

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
          <h1 className="text-3xl font-bold mb-2">{t("security.resetPasswordTitle")}</h1>
          <p className="text-slate-300">{t("security.resetPasswordDesc")}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          <Suspense fallback={<div className="text-slate-600 text-center">{t("common.loading")}</div>}>
            <ResetPasswordForm />
          </Suspense>
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
