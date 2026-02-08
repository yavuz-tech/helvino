"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PublicLayout from "@/components/PublicLayout";
import ErrorBanner from "@/components/ErrorBanner";
import { useI18n } from "@/i18n/I18nContext";
import { designTokens } from "@/lib/designTokens";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
          <div className="w-full max-w-[420px]">
            <div className={`bg-white rounded-2xl ${designTokens.shadows.card} border border-slate-200/80 p-8 text-center animate-pulse`}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100" />
              <div className="h-5 bg-slate-100 rounded-lg mx-auto w-48 mb-4" />
              <div className="h-4 bg-slate-100 rounded-lg mx-auto w-64" />
            </div>
          </div>
        </div>
      </PublicLayout>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error" | "expired">("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const expires = searchParams.get("expires");
    const sig = searchParams.get("sig");

    if (!token || !expires || !sig) {
      setStatus("error");
      setErrorMessage(t("verifyEmail.failed"));
      return;
    }

    const verify = async () => {
      try {
        const url = `${API_URL}/portal/auth/verify-email?token=${encodeURIComponent(token)}&expires=${encodeURIComponent(expires)}&sig=${encodeURIComponent(sig)}`;
        const response = await fetch(url);
        const data = await response.json();
        const rid = data?.requestId || response.headers.get("x-request-id") || null;
        setRequestId(rid);

        if (response.ok && data.ok) {
          setStatus("success");
        } else {
          const code = data?.error?.code;
          if (code === "LINK_EXPIRED") {
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
        }
      } catch {
        setStatus("error");
        setErrorMessage(t("verifyEmail.failed"));
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PublicLayout>
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-[420px]">
          <div className={`bg-white rounded-2xl ${designTokens.shadows.card} border border-slate-200/80 p-8 text-center`}>
            {status === "verifying" && (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-[#0F5C5C] animate-spin" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">
                  {t("verifyEmail.title")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("verifyEmail.verifying")}
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">
                  {t("verifyEmail.title")}
                </h2>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  {t("verifyEmail.success")}
                </p>
                <Link href="/portal/login" className={designTokens.buttons.primary}>
                  {t("verifyEmail.loginCta")}
                </Link>
              </>
            )}

            {(status === "error" || status === "expired") && (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">
                  {t("verifyEmail.title")}
                </h2>
                {errorMessage && (
                  <ErrorBanner
                    message={errorMessage}
                    requestId={requestId}
                    className="mb-4 text-left"
                  />
                )}
                <div className="flex flex-col gap-3 mt-4">
                  <Link href="/portal/login" className={`${designTokens.buttons.primary} w-full`}>
                    {t("verifyEmail.loginCta")}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
