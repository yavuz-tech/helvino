"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { storePortalRefreshToken } from "@/lib/portal-auth";
import { mapPasswordPolicyError } from "@/lib/password-errors";

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
      <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center p-4">
        <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-8 max-w-md w-full text-center">
          <p className="text-red-600 text-sm">{t("team.invalidToken")}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof data?.error === "object" ? data.error?.code : undefined;
        const message = typeof data?.error === "object" ? data.error?.message : data?.error;
        setError(mapPasswordPolicyError(t, code, message || t("team.failedAction")));
        setLoading(false);
        return;
      }

      if (data.refreshToken) {
        storePortalRefreshToken(data.refreshToken);
      }
      setSuccess(true);
      setTimeout(() => router.push("/portal"), 1500);
    } catch {
      setError(t("team.networkError"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center p-4">
      <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block w-16 h-16 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1D23] font-heading">{t("team.welcomeTitle")}</h1>
          <p className="text-[#475569] mt-2">{t("team.welcomeSubtitle")}</p>
        </div>

        <div className="bg-white rounded-lg border border-[#F3E8D8] p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-[#1A1D23] font-heading mb-6">{t("team.setPassword")}</h2>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-sm">
              {t("team.acceptSuccess")}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#475569] mb-2">
                  {t("team.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-[#F1F5F9]"
                />
                <p className="text-xs text-[#64748B] mt-1">{t("team.passwordHint")}</p>
              </div>

              <div>
                <label htmlFor="confirmPw" className="block text-sm font-medium text-[#475569] mb-2">
                  {t("team.confirmPassword")}
                </label>
                <input
                  id="confirmPw"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  minLength={12}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-[#F1F5F9]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors disabled:from-amber-300 disabled:to-amber-300"
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
    <Suspense fallback={<div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center"><p>Loading...</p></div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
