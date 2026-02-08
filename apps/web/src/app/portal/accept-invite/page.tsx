"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function AcceptInviteForm() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const expires = searchParams.get("expires") || "";
  const sig = searchParams.get("sig") || "";

  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
        <div className="bg-white rounded-lg border border-slate-200 p-8 max-w-md w-full text-center">
          <p className="text-red-600 text-sm">{t("team.invalidToken")}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError(t("team.passwordHint"));
      return;
    }
    if (password !== confirmPw) {
      setError(t("team.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/auth/accept-invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, ...(expires && sig ? { expires, sig } : {}) }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("team.failedAction"));
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/portal"), 1500);
    } catch {
      setError(t("team.networkError"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t("team.welcomeTitle")}</h1>
          <p className="text-slate-600 mt-2">{t("team.welcomeSubtitle")}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">{t("team.setPassword")}</h2>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
              {t("team.acceptSuccess")}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  {t("team.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
                />
                <p className="text-xs text-slate-500 mt-1">{t("team.passwordHint")}</p>
              </div>

              <div>
                <label htmlFor="confirmPw" className="block text-sm font-medium text-slate-700 mb-2">
                  {t("team.confirmPassword")}
                </label>
                <input
                  id="confirmPw"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
              >
                {loading ? t("team.accepting") : t("team.acceptInvite")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p>Loading...</p></div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
