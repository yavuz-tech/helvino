"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { orgLogin, checkOrgAuth } from "@/lib/org-auth";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function OrgLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      const user = await checkOrgAuth();
      if (user) router.push("/org-app");
    };
    verifyAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await orgLogin(email, password);
    if (result.ok) {
      router.push("/org-app");
      router.refresh();
    } else {
      setError(result.error || t("auth.loginFailed"));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Helvion</h1>
          <p className="text-slate-600">{t("auth.orgPortal")}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">{t("auth.signIn")}</h2>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {error}
            </div>
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

          <div className="mt-6 pt-6 border-t border-slate-200 text-center text-sm text-slate-600">
            {t("auth.internalAdmin")}{" "}
            <a href="/login" className="text-slate-900 font-medium hover:underline">
              {t("auth.loginHere")}
            </a>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-slate-600">
          <p>{t("auth.needAccess")}</p>
        </div>
      </div>
    </div>
  );
}
