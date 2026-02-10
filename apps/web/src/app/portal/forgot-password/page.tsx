"use client";

import { useState } from "react";
import Link from "next/link";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBanner from "@/components/ErrorBanner";

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
  const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

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
          setShowCaptcha(true);
          setError(t("security.resetCaptchaRequired"));
        } else if (code === "INVALID_CAPTCHA") {
          setShowCaptcha(true);
          setCaptchaToken(null);
          setError(t("security.resetCaptchaInvalid"));
        } else {
          setError(msg || t("common.error"));
        }
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
              {t("security.forgotPasswordTitle")}
            </div>
            <h1 className="max-w-xl text-5xl font-bold leading-[1.05] tracking-tight">
              {t("security.forgotPasswordTitle")}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-200">
              {t("security.forgotPasswordDesc")}
            </p>
            <div className="mt-8 h-px w-72 bg-gradient-to-r from-cyan-300/70 via-white/50 to-transparent" />
          </section>

          <section className="mx-auto w-full max-w-[520px]">
            <div className="mb-6 text-center text-white lg:hidden">
              <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-slate-100 shadow-[0_10px_30px_rgba(255,255,255,0.3)]">
                <span className="text-2xl font-bold text-slate-900">H</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{t("security.forgotPasswordTitle")}</h1>
              <p className="mt-2 text-sm text-slate-300">{t("security.forgotPasswordDesc")}</p>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-white/35 via-cyan-200/20 to-violet-200/20 p-[1px] shadow-[0_35px_90px_rgba(6,12,24,0.6)]">
              <div className="rounded-3xl border border-white/15 bg-slate-900/55 p-7 backdrop-blur-2xl sm:p-8">
                {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

                {success ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                      {t("security.resetLinkSent")}
                    </div>
                    {resetLink && (
                      <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-4">
                        <p className="mb-1 text-xs font-medium text-amber-100">{t("security.resetLinkDev")}</p>
                        <a
                          href={resetLink}
                          className="break-all font-mono text-xs text-amber-50 underline decoration-dotted underline-offset-2 hover:text-white"
                        >
                          {resetLink}
                        </a>
                      </div>
                    )}
                    <Link
                      href="/portal/login"
                      className="block w-full rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      {t("security.backToLogin")}
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                        {t("auth.email")}
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 outline-none transition-all focus:border-cyan-300/60 focus:bg-white/15 focus:ring-2 focus:ring-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder={t("portalLogin.emailPlaceholder")}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    {showCaptcha && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                          {t("security.resetCaptchaLabel")}
                        </p>
                        {captchaSiteKey ? (
                          <div className="overflow-hidden rounded-xl border border-white/15 bg-white/5 p-2">
                            <HCaptcha
                              sitekey={captchaSiteKey}
                              onVerify={(token) => setCaptchaToken(token)}
                              onExpire={() => setCaptchaToken(null)}
                              onError={() => setCaptchaToken(null)}
                            />
                          </div>
                        ) : (
                          <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                            {t("security.resetCaptchaMissingKey")}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(6,182,212,0.35)] transition-all hover:brightness-110 hover:shadow-[0_12px_30px_rgba(6,182,212,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isLoading || (showCaptcha && (!captchaSiteKey || !captchaToken))}
                    >
                      {isLoading ? t("security.sendingResetLink") : t("security.sendResetLink")}
                    </button>
                  </form>
                )}
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
