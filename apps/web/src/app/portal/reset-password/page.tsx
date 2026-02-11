"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check, CheckCircle2, LockKeyhole } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBanner from "@/components/ErrorBanner";
import { mapPasswordPolicyError } from "@/lib/password-errors";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function evaluatePasswordRules(password: string) {
  const rules = {
    minLength8: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(rules).filter(Boolean).length;
  if (score <= 2) return { rules, score, level: "weak" as const };
  if (score <= 4) return { rules, score, level: "medium" as const };
  return { rules, score, level: "strong" as const };
}

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
  const evaluation = evaluatePasswordRules(newPassword);

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
      <div className="rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] p-4 text-sm text-[var(--text-secondary)]">
        {t("security.resetTokenChecking")}
      </div>
    );
  }

  if (!token || !isTokenValid) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-300/60 bg-rose-50/80 p-4 text-sm text-rose-700">
          {t("security.invalidResetToken")}
        </div>
        <Link
          href="/portal/login"
          className="block w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2.5 text-center text-sm font-semibold text-[var(--primary)] transition hover:brightness-105"
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
        <motion.div
          className="space-y-3 rounded-xl border border-emerald-300/60 bg-emerald-50/80 p-4 text-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/90">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-emerald-700">{t("security.passwordResetSuccess")}</p>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]"
            >
              {t("security.newPassword")}
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="••••••••"
              required
              disabled={isLoading}
              minLength={8}
            />

            {newPassword ? (
              <div className="mt-3 rounded-xl border border-amber-100/80 bg-white/80 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {t("passwordStrength.title")}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      evaluation.level === "weak"
                        ? "text-rose-500"
                        : evaluation.level === "medium"
                          ? "text-amber-600"
                          : "text-emerald-600"
                    }`}
                  >
                    {evaluation.level === "weak"
                      ? t("passwordStrength.weak")
                      : evaluation.level === "medium"
                        ? t("passwordStrength.medium")
                        : t("passwordStrength.strong")}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(evaluation.score / 5) * 100}%`,
                      background:
                        evaluation.level === "weak"
                          ? "#FB7185"
                          : evaluation.level === "medium"
                            ? "#F59E0B"
                            : "linear-gradient(90deg, #10B981 0%, #F59E0B 100%)",
                    }}
                  />
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
                    {t("security.passwordRequirements")}
                  </p>
                  <ul className="space-y-1.5">
                    {[
                      { key: "passwordReq.minLength8", met: evaluation.rules.minLength8 },
                      { key: "passwordReq.uppercase", met: evaluation.rules.uppercase },
                      { key: "passwordReq.lowercase", met: evaluation.rules.lowercase },
                      { key: "passwordReq.number", met: evaluation.rules.number },
                      { key: "passwordReq.special", met: evaluation.rules.special },
                    ].map((item) => (
                      <li key={item.key} className="flex items-center gap-2 text-xs">
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                            item.met ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          <Check size={11} />
                        </span>
                        <span className={item.met ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                          {t(item.key as Parameters<typeof t>[0])}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]"
            >
              {t("security.confirmNewPassword")}
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="••••••••"
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? t("security.resettingPassword") : t("security.saveNewPassword")}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();

  return (
    <motion.div
      className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8"
      style={{
        background:
          "radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(251, 113, 133, 0.15), transparent 50%), linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-72 w-72 rounded-full bg-rose-300/25 blur-3xl" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-center py-8 lg:min-h-[calc(100vh-4rem)] lg:py-0">
        <motion.section
          className="mx-auto w-full max-w-[440px]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="rounded-3xl bg-gradient-to-br from-amber-300/55 via-rose-200/45 to-amber-100/65 p-[1px] shadow-[0_30px_80px_rgba(149,115,22,0.25)]">
            <div className="rounded-3xl border border-amber-100/80 bg-[var(--bg-glass)] p-7 backdrop-blur-2xl sm:p-8">
              <div className="mb-4 text-center">
                <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-400 shadow-[0_10px_24px_rgba(245,158,11,0.35)]">
                  <LockKeyhole className="h-7 w-7 text-[var(--primary)]" />
                </div>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">{t("security.resetPasswordTitle")}</h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("security.resetPasswordDesc")}</p>
              </div>

              <Suspense
                fallback={
                  <div className="flex items-center justify-center rounded-2xl border border-amber-200/70 bg-[var(--bg-glass)] p-6 text-sm text-[var(--text-secondary)]">
                    {t("common.loading")}
                  </div>
                }
              >
                <ResetPasswordForm />
              </Suspense>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/portal/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--highlight)] transition-opacity hover:opacity-80"
            >
              <ArrowLeft size={14} />
              <span>{t("security.backToLogin")}</span>
            </Link>
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
