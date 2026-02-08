"use client";

import { useState } from "react";
import Link from "next/link";
import PublicLayout from "@/components/PublicLayout";
import ErrorBanner from "@/components/ErrorBanner";
import { useI18n } from "@/i18n/I18nContext";
import PasswordStrength from "@/components/PasswordStrength";
import { designTokens } from "@/lib/designTokens";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function SignupPage() {
  const { t, locale } = useI18n();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [resendLocked, setResendLocked] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const MAX_RESEND = 3;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRequestId(null);
    setIsLoading(true);

    try {
      const trimmedWebsite = orgName.trim();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: trimmedWebsite, email: trimmedEmail, password, locale }),
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
        const msg =
          typeof data?.error === "object"
            ? data.error.message
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

  return (
    <PublicLayout>
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-[420px]">
          {success ? (
            /* ── Success State ── */
            <div className={`bg-white rounded-2xl ${designTokens.shadows.card} border border-slate-200/80 p-8 text-center`}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                {t("signup.successTitle")}
              </h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                {t("signup.successMessage")}
              </p>
              <div className="mb-5 text-sm text-slate-500">
                {t("signup.resendHint")}
              </div>
              {resendError && (
                <div className="mb-4 text-sm text-red-600">
                  {resendError}
                </div>
              )}
              {resendSuccess && (
                <div className="mb-4 text-sm font-semibold text-emerald-600">
                  {t("signup.resendSent")}
                </div>
              )}
              {resendLocked ? (
                <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  {t("signup.resendLocked")}
                </div>
              ) : resendCount < MAX_RESEND ? (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className={`w-full ${designTokens.buttons.secondary}`}
                  >
                    {resendLoading ? t("common.loading") : t("signup.resendVerification")}
                  </button>
                  {resendCount > 0 && (
                    <p className="mt-2 text-xs text-slate-400 text-center">
                      {t("signup.resendRemaining").replace("{remaining}", String(MAX_RESEND - resendCount))}
                    </p>
                  )}
                </div>
              ) : null}
              <Link href="/portal/login" className={designTokens.buttons.primary}>
                {t("signup.loginLink")}
              </Link>
            </div>
          ) : (
            /* ── Signup Form ── */
            <div className={`bg-white rounded-2xl ${designTokens.shadows.card} border border-slate-200/80 p-7`}>
              <h1 className="text-xl font-bold text-slate-900 mb-1 tracking-tight">
                {t("signup.title")}
              </h1>
              <p className="text-sm text-slate-500 mb-6">
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
                  <label className={designTokens.inputs.label}>
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
                    className={designTokens.inputs.base}
                  />
                  <p className={designTokens.inputs.helper}>{t("validation.websiteHint")}</p>
                </div>

                <div>
                  <label className={designTokens.inputs.label}>
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
                    className={designTokens.inputs.base}
                  />
                  <p className={designTokens.inputs.helper}>{t("validation.emailHint")}</p>
                </div>

                <div>
                  <label className={designTokens.inputs.label}>
                    {t("signup.password")}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("signup.passwordPlaceholder")}
                    required
                    minLength={8}
                    className={designTokens.inputs.base}
                  />
                  <PasswordStrength password={password} minLength={8} />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full ${designTokens.buttons.primary} py-3`}
                >
                  {isLoading ? t("signup.submitting") : t("signup.submit")}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                {t("signup.haveAccount")}{" "}
                <Link
                  href="/portal/login"
                  className="text-[#0F5C5C] font-semibold hover:underline"
                >
                  {t("signup.loginLink")}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
