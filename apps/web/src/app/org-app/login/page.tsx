"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { orgLogin, checkOrgAuth } from "@/lib/org-auth";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import HelvionLogo from "@/components/brand/HelvionLogo";

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
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center">
            <HelvionLogo variant="light" heightClassName="h-14 sm:h-16" className="hv-logo-float" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#F3E8D8] p-8 shadow-sm">
          <h2 className="text-center text-xl font-semibold text-[#1A1D23] mb-6">{t("auth.signIn")}</h2>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#334155] mb-2">
                {t("auth.email")}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                placeholder="you@company.com"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#334155] mb-2">
                {t("auth.password")}
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors disabled:from-amber-300 disabled:to-amber-300"
              disabled={isLoading}
            >
              {isLoading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#F3E8D8] text-center text-sm text-[#475569]">
            {t("auth.internalAdmin")}{" "}
            <a href="/login" className="text-[#1A1D23] font-medium hover:underline">
              {t("auth.loginHere")}
            </a>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-[#475569]">
          <p>{t("auth.needAccess")}</p>
        </div>
      </div>
    </div>
  );
}
