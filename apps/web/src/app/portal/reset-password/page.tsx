"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBanner from "@/components/ErrorBanner";
import PasswordStrength from "@/components/PasswordStrength";
import { mapPasswordPolicyError } from "@/lib/password-errors";

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
  const [isTokenChecking, setIsTokenChecking] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verifyToken = async () => {
      if (!token) {
        if (!cancelled) {
          setIsTokenValid(false);
          setIsTokenChecking(false);
        }
        return;
      }

      try {
        const query = new URLSearchParams({ token });
        if (expires && sig) {
          query.set("expires", expires);
          query.set("sig", sig);
        }

        const res = await fetch(`${API_URL}/portal/auth/reset-password/validate?${query.toString()}`, {
          method: "GET",
          credentials: "include",
        });

        if (!cancelled) {
          if (res.ok) {
            setIsTokenValid(true);
            setError(null);
          } else {
            setIsTokenValid(false);
            setError(t("security.invalidResetToken"));
            setTimeout(() => {
              router.push("/portal/forgot-password");
            }, 2000);
          }
        }
      } catch {
        if (!cancelled) {
          setIsTokenValid(false);
          setError(t("common.networkError"));
        }
      } finally {
        if (!cancelled) {
          setIsTokenChecking(false);
        }
      }
    };

    verifyToken();
    return () => {
      cancelled = true;
    };
  }, [token, expires, sig, router, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
        const code = typeof data?.error === "object" ? data.error?.code : undefined;
        const message = typeof data?.error === "object" ? data.error?.message : data?.error;
        setError(mapPasswordPolicyError(t, code, message || t("security.invalidResetToken")));
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

  if (isTokenChecking) {
    return (
      <div className="rounded-xl border border-white/20 bg-white/5 p-4 text-sm text-slate-200">
        {t("security.resetTokenChecking")}
      </div>
    );
  }

  if (!token || !isTokenValid) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-300/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {t("security.invalidResetToken")}
        </div>
        <Link
          href="/portal/login"
          className="block w-full rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-white/15"
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
        <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {t("security.passwordResetSuccess")}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="newPassword" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              {t("security.newPassword")}
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 outline-none transition-all focus:border-cyan-300/60 focus:bg-white/15 focus:ring-2 focus:ring-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="••••••••"
              required
              disabled={isLoading}
              minLength={12}
            />
            <div className="mt-2 rounded-lg bg-white px-3 py-2">
              <PasswordStrength password={newPassword} minLength={12} />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              {t("security.confirmNewPassword")}
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 outline-none transition-all focus:border-cyan-300/60 focus:bg-white/15 focus:ring-2 focus:ring-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="••••••••"
              required
              disabled={isLoading}
              minLength={12}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(6,182,212,0.35)] transition-all hover:brightness-110 hover:shadow-[0_12px_30px_rgba(6,182,212,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="relative min-h-screen overflow-hidden bg-[#060F25] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_18%,rgba(147,51,234,0.22),transparent_42%),radial-gradient(circle_at_88%_78%,rgba(34,211,238,0.2),transparent_44%),linear-gradient(130deg,#060F25_0%,#0A1C3F_46%,#0A2A3A_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-center py-8 lg:min-h-[calc(100vh-4rem)] lg:py-0">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <section className="hidden text-white lg:block">
            <div className="mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm">
              {t("security.resetPasswordTitle")}
            </div>
            <h1 className="max-w-xl text-5xl font-bold leading-[1.05] tracking-tight">
              {t("security.resetPasswordTitle")}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-200">
              {t("security.resetPasswordDesc")}
            </p>
            <div className="mt-8 h-px w-72 bg-gradient-to-r from-cyan-300/70 via-white/50 to-transparent" />
          </section>

          <section className="mx-auto w-full max-w-[520px]">
            <div className="mb-6 text-center text-white lg:hidden">
              <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-slate-100 shadow-[0_10px_30px_rgba(255,255,255,0.3)]">
                <span className="text-2xl font-bold text-slate-900">H</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{t("security.resetPasswordTitle")}</h1>
              <p className="mt-2 text-sm text-slate-300">{t("security.resetPasswordDesc")}</p>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-white/35 via-cyan-200/20 to-violet-200/20 p-[1px] shadow-[0_35px_90px_rgba(6,12,24,0.6)]">
              <div className="rounded-3xl border border-white/15 bg-slate-900/55 p-7 backdrop-blur-2xl sm:p-8">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
                      {t("common.loading")}
                    </div>
                  }
                >
                  <ResetPasswordForm />
                </Suspense>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-slate-300">
              <Link href="/portal/login" className="font-medium text-white/95 transition hover:text-cyan-200">
                {t("security.backToLogin")}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
