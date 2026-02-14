"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBanner from "@/components/ErrorBanner";
import TurnstileWidget from "@/components/TurnstileWidget";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ForgotPasswordPage() {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRenderNonce, setCaptchaRenderNonce] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  useEffect(() => {
    if (!resendCountdown) return;
    const timer = window.setInterval(() => {
      setResendCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  const sendResetRequest = async () => {
    setError(null);
    setIsLoading(true);
    if (!success) {
      setResetLink(null);
    }

    try {
      const res = await fetch(`${API_URL}/portal/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          locale,
          ...(captchaToken ? { captchaToken } : {}),
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setError(data?.error?.message || t("security.resetTooManyRequests"));
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const code = typeof data?.error === "object" ? data.error?.code : undefined;
        const msg = typeof data?.error === "object" ? data.error?.message : data?.error;
        if (code === "CAPTCHA_REQUIRED") {
          if (captchaSiteKey) {
            setShowCaptcha(true);
            setError(t("security.resetCaptchaRequired"));
          } else {
            setShowCaptcha(false);
            setError(t("security.resetCaptchaMissingKey"));
          }
        } else if (code === "INVALID_CAPTCHA") {
          if (captchaSiteKey) {
            setShowCaptcha(true);
          }
          setCaptchaToken(null);
          setCaptchaRenderNonce((v) => v + 1);
          setError(t("security.resetCaptchaInvalid"));
        } else {
          setError(msg || t("common.error"));
        }
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setResendCountdown(30);
      if (data.resetLink) {
        setResetLink(data.resetLink);
      }
    } catch {
      setError(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetRequest();
  };

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
              {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}

              {success ? (
                <div className="space-y-4 text-center">
                  <motion.div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50"
                    initial={{ scale: 0.75, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </motion.div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {t("security.resetLinkSentTitle")}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">{t("security.resetLinkSent")}</p>

                  {resetLink && (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-50/80 p-4 text-left">
                      <p className="mb-1 text-xs font-medium text-amber-800">{t("security.resetLinkDev")}</p>
                      <a
                        href={resetLink}
                        className="break-all font-mono text-xs text-amber-900 underline decoration-dotted underline-offset-2 hover:opacity-80"
                      >
                        {resetLink}
                      </a>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={sendResetRequest}
                    disabled={isLoading || resendCountdown > 0}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? t("security.sendingResetLink") : t("security.resendResetLink")}
                  </button>
                  {resendCountdown > 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      {t("security.resendCountdown").replace("{seconds}", String(resendCountdown))}
                    </p>
                  ) : null}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="mb-2 text-center">
                    <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-400 shadow-[0_10px_24px_rgba(245,158,11,0.35)]">
                      <Mail className="h-7 w-7 text-[var(--primary)]" />
                    </div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">{t("security.forgotPasswordTitle")}</h1>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("security.forgotPasswordDesc")}</p>
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]"
                    >
                      {t("auth.email")}
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder={t("portalLogin.emailPlaceholder")}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {showCaptcha && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        {t("security.resetCaptchaLabel")}
                      </p>
                      {captchaSiteKey ? (
                        <div className="overflow-hidden rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] p-2">
                          <TurnstileWidget
                            key={captchaRenderNonce}
                            siteKey={captchaSiteKey}
                            onVerify={(token) => setCaptchaToken(token)}
                            onExpire={() => setCaptchaToken(null)}
                            onError={() => setCaptchaToken(null)}
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-amber-300/60 bg-amber-50/80 p-3 text-xs text-amber-800">
                          {t("security.resetCaptchaMissingKey")}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoading || (showCaptcha && !captchaToken)}
                  >
                    {isLoading ? t("security.sendingResetLink") : t("security.sendResetLink")}
                  </button>
                </form>
              )}
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
