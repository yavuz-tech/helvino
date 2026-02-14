"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ShieldCheck, Sparkles, Users } from "lucide-react";
import ErrorBanner from "@/components/ErrorBanner";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { mapPasswordPolicyError } from "@/lib/password-errors";
import { sanitizePlainText } from "@/utils/sanitize";
import TurnstileWidget from "@/components/TurnstileWidget";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export default function SignupPage() {
  const { t, locale } = useI18n();
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verifyChecking, setVerifyChecking] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [resendLocked, setResendLocked] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRenderNonce, setCaptchaRenderNonce] = useState(0);
  const MAX_RESEND = 6;

  const websitePattern = /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
  const websitePatternText = "(https?:\\/\\/)?(www\\.)?[a-z0-9-]+(\\.[a-z0-9-]+)+";

  // Email: must have a real TLD (min 2 chars) and proper domain structure
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const validateEmail = (value: string): boolean => {
    if (!emailPattern.test(value)) return false;
    const domain = value.split("@")[1];
    if (!domain) return false;
    const parts = domain.split(".");
    const tld = parts[parts.length - 1];
    // TLD must be at least 2 chars and the domain part before TLD must be at least 2 chars
    if (tld.length < 2) return false;
    if (parts[0].length < 2) return false;
    return true;
  };

  const evaluatePasswordRules = (value: string) => {
    const rules = {
      minLength8: value.length >= 8,
      uppercase: /[A-Z]/.test(value),
      lowercase: /[a-z]/.test(value),
      number: /\d/.test(value),
      special: /[^A-Za-z0-9]/.test(value),
    };

    const score = Object.values(rules).filter(Boolean).length;
    if (score <= 2) return { rules, score, level: "weak" as const };
    if (score <= 4) return { rules, score, level: "medium" as const };
    return { rules, score, level: "strong" as const };
  };

  const passwordEvaluation = evaluatePasswordRules(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRequestId(null);
    setIsLoading(true);

    try {
      const sanitizedFullName = sanitizePlainText(fullName).trim();
      if (!sanitizedFullName) {
        setError(t("signup.fullNameRequired"));
        setIsLoading(false);
        return;
      }

      if (!acceptedTerms) {
        setError(t("signup.acceptTermsError"));
        setIsLoading(false);
        return;
      }

      const trimmedWebsite = sanitizePlainText(orgName).trim();
      if (!websitePattern.test(trimmedWebsite)) {
        setError(t("validation.website"));
        setIsLoading(false);
        return;
      }

      const trimmedEmail = email.trim().toLowerCase();
      if (!validateEmail(trimmedEmail)) {
        setError(t("validation.email"));
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/portal/auth/signup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: trimmedWebsite,
          email: trimmedEmail,
          password,
          locale,
          captchaToken: captchaToken || undefined,
        }),
      });

      const data = await response.json();
      const rid = data?.requestId || response.headers.get("x-request-id") || null;
      setRequestId(rid);

      if (response.status === 429) {
        const seconds = data?.error?.retryAfterSec || 30;
        setError(t("rateLimit.message").replace("{seconds}", String(seconds)));
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorCode = typeof data?.error === "object" ? data.error?.code : undefined;
        if (errorCode === "CAPTCHA_REQUIRED") {
          setError(t("portalLogin.captchaRequired"));
          setIsLoading(false);
          return;
        }
        if (errorCode === "INVALID_CAPTCHA") {
          setCaptchaToken(null);
          setCaptchaRenderNonce((v) => v + 1);
          setError(t("portalLogin.invalidCaptcha"));
          setIsLoading(false);
          return;
        }
        if (errorCode === "DISPOSABLE_EMAIL_NOT_ALLOWED") {
          setError(t("signup.disposableEmailBlocked"));
          setIsLoading(false);
          return;
        }
        const msg =
          typeof data?.error === "object"
            ? mapPasswordPolicyError(t, errorCode, data.error.message || t("signup.error"))
            : data?.error || t("signup.error");
        setError(msg);
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("signup.error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || resendLocked || resendCount >= MAX_RESEND) return;
    setResendError(null);
    setResendSuccess(false);
    setResendLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/auth/resend-verification`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (res.status === 429) {
        setResendLocked(true);
        setResendError(t("signup.resendLocked"));
        setResendLoading(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error?.message || data?.error || t("signup.resendError");
        setResendError(msg);
        setResendLoading(false);
        return;
      }
      const newCount = resendCount + 1;
      setResendCount(newCount);
      setResendSuccess(true);
      if (newCount >= MAX_RESEND) {
        setResendLocked(true);
      }
    } catch {
      setResendError(t("signup.resendError"));
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifiedContinue = async () => {
    if (!email || !password) {
      setResendError(t("signup.verificationStillPending"));
      return;
    }

    setVerifyChecking(true);
    setResendError(null);

    try {
      const response = await fetch(`${API_URL}/portal/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          locale,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.ok) {
        window.location.href = "/portal";
        return;
      }

      const errorCode = typeof data?.error === "object" ? data.error?.code : undefined;
      if (errorCode === "EMAIL_VERIFICATION_REQUIRED") {
        setResendError(t("signup.verificationStillPending"));
        return;
      }

      setResendError(
        (typeof data?.error === "object" ? data.error?.message : data?.error) || t("signup.error")
      );
    } catch {
      setResendError(t("common.networkError"));
    } finally {
      setVerifyChecking(false);
    }
  };

  return (
    <motion.div
      className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8"
      style={{
        background:
          "radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(251, 113, 133, 0.15), transparent 50%), linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-24 h-72 w-72 rounded-full bg-rose-300/25 blur-3xl" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-center py-6 lg:min-h-[calc(100vh-3rem)] lg:py-0">
        <div className="grid w-full items-center gap-8 lg:grid-cols-5 lg:gap-12">
          <section className="hidden lg:col-span-2 lg:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/60 px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] backdrop-blur-sm">
              <Sparkles size={14} className="text-[var(--accent)]" />
              <span>{t("signup.heroBadge")}</span>
            </div>
            <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight text-[var(--text-primary)]">
              {t("signup.heroTitle")}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--text-secondary)]">
              {t("signup.heroSubtitle")}
            </p>
            <div className="mt-8 space-y-3">
              {[t("signup.heroBulletOne"), t("signup.heroBulletTwo"), t("signup.heroBulletThree")].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-amber-200/70 bg-white/65 px-4 py-3 backdrop-blur-sm"
                >
                  <ShieldCheck size={18} className="shrink-0 text-[var(--accent)]" />
                  <span className="text-sm text-[var(--text-primary)]">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-amber-200/70 bg-white/70 px-3 py-2 text-xs text-[var(--text-secondary)] backdrop-blur-sm">
              <Users size={14} className="text-[var(--accent)]" />
              <span>{t("signup.socialProof")}</span>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[560px] lg:col-span-3">
            <motion.div
              className="rounded-3xl bg-gradient-to-br from-amber-300/55 via-rose-200/45 to-amber-100/65 p-[1px] shadow-[0_30px_80px_rgba(149,115,22,0.25)]"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div className="rounded-3xl border border-amber-100/80 bg-[var(--bg-glass)] p-7 backdrop-blur-2xl">
                <div className="mb-5 flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-400 shadow-[0_10px_24px_rgba(245,158,11,0.35)]">
                    <span className="font-bold text-[var(--primary)]">H</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Helvion</p>
                    <p className="text-xs text-[var(--text-secondary)]">{t("signup.subtitle")}</p>
                  </div>
                </div>

                {success ? (
                  <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                      <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">
                      {t("signup.successTitle")}
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      {t("signup.successMessage")}
                    </p>
                    <div className="text-sm text-[var(--text-secondary)]">
                      {t("signup.resendHint")}
                    </div>
                    {resendError && (
                      <div className="text-sm text-rose-700">
                        {resendError}
                      </div>
                    )}
                    {resendSuccess && (
                      <div className="text-sm font-semibold text-emerald-700">
                        {t("signup.resendSent")}
                      </div>
                    )}
                    {resendLocked ? (
                      <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
                        {t("signup.resendLocked")}
                      </div>
                    ) : resendCount < MAX_RESEND ? (
                      <div>
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendLoading}
                          className="w-full rounded-xl border border-amber-200/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-white disabled:opacity-60"
                        >
                          {resendLoading ? t("common.loading") : t("signup.resendVerification")}
                        </button>
                        {resendCount > 0 && (
                          <p className="mt-2 text-xs text-[var(--text-muted)] text-center">
                            {t("signup.resendRemaining").replace("{remaining}", String(MAX_RESEND - resendCount))}
                          </p>
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleVerifiedContinue}
                      disabled={verifyChecking}
                      className="w-full rounded-xl border border-emerald-300/80 bg-emerald-50/80 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
                    >
                      {verifyChecking ? t("common.loading") : t("signup.iVerifiedCta")}
                    </button>
                    <Link
                      href="/portal/login"
                      className="block w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-center text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105"
                    >
                      {t("signup.loginLink")}
                    </Link>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1 tracking-tight">
                      {t("signup.title")}
                    </h1>
                    <p className="text-sm text-[var(--text-secondary)] mb-6">
                      {t("signup.subtitle")}
                    </p>

                    {error && (
                      <ErrorBanner
                        message={error}
                        requestId={requestId}
                        onDismiss={() => setError(null)}
                        className="mb-4"
                      />
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          {t("signup.workspaceName")}
                        </label>
                        <input
                          type="text"
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          onInvalid={(e) => e.currentTarget.setCustomValidity(t("validation.website"))}
                          onInput={(e) => e.currentTarget.setCustomValidity("")}
                          placeholder={t("signup.workspacePlaceholder")}
                          required
                          minLength={2}
                          maxLength={100}
                          pattern={websitePatternText}
                          inputMode="url"
                          autoCapitalize="none"
                          autoCorrect="off"
                          className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          {t("signup.fullName")}
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder={t("signup.fullNamePlaceholder")}
                          required
                          minLength={2}
                          maxLength={120}
                          className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          {t("signup.email")}
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t("signup.emailPlaceholder")}
                          required
                          pattern="[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}"
                          onInvalid={(e) => e.currentTarget.setCustomValidity(t("validation.email"))}
                          onInput={(e) => e.currentTarget.setCustomValidity("")}
                          autoCapitalize="none"
                          autoCorrect="off"
                          className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          {t("signup.password")}
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t("signup.passwordPlaceholder")}
                          required
                          minLength={8}
                          className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                        />

                        {password ? (
                          <div className="mt-3 rounded-xl border border-amber-100/80 bg-white/80 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                                {t("passwordStrength.title")}
                              </span>
                              <span
                                className={`text-xs font-semibold ${
                                  passwordEvaluation.level === "weak"
                                    ? "text-rose-500"
                                    : passwordEvaluation.level === "medium"
                                      ? "text-amber-600"
                                      : "text-emerald-600"
                                }`}
                              >
                                {passwordEvaluation.level === "weak"
                                  ? t("passwordStrength.weak")
                                  : passwordEvaluation.level === "medium"
                                    ? t("passwordStrength.medium")
                                    : t("passwordStrength.strong")}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${(passwordEvaluation.score / 5) * 100}%`,
                                  background:
                                    passwordEvaluation.level === "weak"
                                      ? "#FB7185"
                                      : passwordEvaluation.level === "medium"
                                        ? "#F59E0B"
                                        : "linear-gradient(90deg, #10B981 0%, #F59E0B 100%)",
                                }}
                              />
                            </div>

                            <ul className="mt-3 space-y-1.5">
                              {[
                                { key: "passwordReq.minLength8", met: passwordEvaluation.rules.minLength8 },
                                { key: "passwordReq.uppercase", met: passwordEvaluation.rules.uppercase },
                                { key: "passwordReq.lowercase", met: passwordEvaluation.rules.lowercase },
                                { key: "passwordReq.number", met: passwordEvaluation.rules.number },
                                { key: "passwordReq.special", met: passwordEvaluation.rules.special },
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
                        ) : null}
                      </div>

                      <label className="flex items-start gap-3 rounded-xl border border-amber-200/70 bg-white/75 p-3 text-xs text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-500 focus:ring-amber-300"
                        />
                        <span>{t("signup.termsText")}</span>
                      </label>

                      {TURNSTILE_SITE_KEY && (
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                            {t("portalLogin.captchaLabel")}
                          </label>
                          <div className="rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] p-2.5">
                            <TurnstileWidget
                              key={captchaRenderNonce}
                              siteKey={TURNSTILE_SITE_KEY}
                              onVerify={(token) => setCaptchaToken(token)}
                              onExpire={() => setCaptchaToken(null)}
                              onError={() => setCaptchaToken(null)}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoading ? t("signup.submitting") : t("signup.startFree")}
                      </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
                      {t("signup.haveAccount")}{" "}
                      <Link
                        href="/portal/login"
                        className="font-semibold text-[var(--highlight)] hover:opacity-80"
                      >
                        {t("signup.loginLink")}
                      </Link>
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
