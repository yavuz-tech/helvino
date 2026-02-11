"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import ErrorBanner from "@/components/ErrorBanner";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen bg-[#FFFBEB]">
        <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-16">
          <div className="w-full max-w-[440px] rounded-3xl border border-amber-100/80 bg-white/70 p-8 backdrop-blur-2xl" />
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error" | "expired">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const token = searchParams.get("token") || "";
  const expires = searchParams.get("expires") || "";
  const sig = searchParams.get("sig") || "";
  const tokenCode = useMemo(
    () =>
      token
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(0, 6)
        .toUpperCase(),
    [token]
  );
  const enteredCode = code.join("").toUpperCase();

  useEffect(() => {
    if (!token || !expires || !sig) {
      setStatus("error");
      setErrorMessage(t("verifyEmail.failed"));
      return;
    }
    if (tokenCode.length === 6) {
      setCode(tokenCode.split(""));
    }
  }, [token, expires, sig, tokenCode, t]);

  useEffect(() => {
    if (!resendCountdown) return;
    const timer = window.setInterval(() => {
      setResendCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (status !== "success") return;
    const timer = window.setTimeout(() => {
      router.push("/portal");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [status, router]);

  const verifyWithLink = async () => {
    if (!token || !expires || !sig) {
      setStatus("error");
      setErrorMessage(t("verifyEmail.failed"));
      return;
    }
    if (enteredCode.length !== 6) {
      setStatus("error");
      setErrorMessage(t("verifyEmail.codeInvalid"));
      return;
    }
    if (tokenCode.length === 6 && enteredCode !== tokenCode) {
      setStatus("error");
      setErrorMessage(t("verifyEmail.codeInvalid"));
      return;
    }

    setStatus("verifying");
    setErrorMessage(null);
    try {
      const url = `${API_URL}/portal/auth/verify-email?token=${encodeURIComponent(token)}&expires=${encodeURIComponent(expires)}&sig=${encodeURIComponent(sig)}`;
      const response = await fetch(url);
      const data = await response.json();
      const rid = data?.requestId || response.headers.get("x-request-id") || null;
      setRequestId(rid);

      if (response.ok && data.ok) {
        setStatus("success");
        return;
      }
      const errorCode = data?.error?.code;
      if (errorCode === "LINK_EXPIRED") {
        setStatus("expired");
        setErrorMessage(t("verifyEmail.expired"));
      } else {
        setStatus("error");
        setErrorMessage(
          typeof data?.error === "object"
            ? data.error.message
            : data?.error || t("verifyEmail.failed")
        );
      }
    } catch {
      setStatus("error");
      setErrorMessage(t("verifyEmail.failed"));
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/[^A-Za-z0-9]/g, "").slice(-1).toUpperCase();
    const next = [...code];
    next[index] = clean;
    setCode(next);
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 6)
      .toUpperCase();
    if (!pasted) return;
    e.preventDefault();
    const next = Array(6).fill("");
    pasted.split("").forEach((char, i) => {
      next[i] = char;
    });
    setCode(next);
    const targetIndex = Math.min(pasted.length, 5);
    inputRefs.current[targetIndex]?.focus();
  };

  const handleResend = async () => {
    if (!resendEmail || resendCountdown > 0) return;
    setResending(true);
    setResendSuccess(false);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_URL}/portal/auth/resend-verification`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail, locale }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = typeof data?.error === "object" ? data.error?.message : data?.error;
        setErrorMessage(msg || t("verifyEmail.failed"));
      } else {
        setResendSuccess(true);
        setResendCountdown(30);
      }
    } catch {
      setErrorMessage(t("common.networkError"));
    } finally {
      setResending(false);
    }
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
              {status === "success" ? (
                <motion.div
                  className="space-y-3 text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{t("verifyEmail.title")}</h2>
                  <p className="text-sm text-[var(--text-secondary)]">{t("verifyEmail.success")}</p>
                </motion.div>
              ) : (
                <>
                  <div className="mb-4 text-center">
                    <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-400 shadow-[0_10px_24px_rgba(245,158,11,0.35)]">
                      <Mail className="h-7 w-7 text-[var(--primary)]" />
                    </div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">{t("verifyEmail.title")}</h1>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("verifyEmail.subtitle")}</p>
                  </div>

                  {errorMessage ? (
                    <ErrorBanner
                      message={errorMessage}
                      requestId={requestId}
                      onDismiss={() => setErrorMessage(null)}
                      className="mb-4"
                    />
                  ) : null}

                  <div className="mb-3">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      {t("verifyEmail.codeLabel")}
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {code.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            inputRefs.current[index] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(index, e)}
                          onPaste={handlePaste}
                          className="h-11 rounded-xl border border-amber-200/70 bg-white/85 text-center text-base font-semibold text-[var(--text-primary)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{t("verifyEmail.codeHint")}</p>
                  </div>

                  <button
                    type="button"
                    onClick={verifyWithLink}
                    disabled={status === "verifying"}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "verifying" ? t("verifyEmail.verifying") : t("verifyEmail.verifyButton")}
                  </button>

                  <div className="mt-4 border-t border-amber-200/70 pt-4">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      {t("verifyEmail.resendEmailLabel")}
                    </label>
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                      placeholder={t("verifyEmail.resendEmailPlaceholder")}
                    />
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending || resendCountdown > 0 || !resendEmail}
                      className="mt-3 text-sm font-semibold text-[var(--highlight)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("verifyEmail.resendCta")}
                    </button>
                    {resendCountdown > 0 ? (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {t("verifyEmail.resendCountdown").replace("{seconds}", String(resendCountdown))}
                      </p>
                    ) : null}
                    {resendSuccess ? (
                      <p className="mt-1 text-xs text-emerald-700">{t("verifyEmail.codeSent")}</p>
                    ) : null}
                  </div>
                </>
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
