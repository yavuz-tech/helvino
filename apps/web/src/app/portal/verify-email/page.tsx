"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PublicLayout from "@/components/PublicLayout";
import ErrorBanner from "@/components/ErrorBanner";
import { useI18n } from "@/i18n/I18nContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center animate-pulse">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100" />
              <div className="h-6 bg-slate-100 rounded mx-auto w-48 mb-4" />
              <div className="h-4 bg-slate-100 rounded mx-auto w-64" />
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
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
            {status === "verifying" && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center animate-pulse">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  {t("verifyEmail.title")}
                </h2>
                <p className="text-slate-500 text-sm">
                  {t("verifyEmail.verifying")}
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  {t("verifyEmail.title")}
                </h2>
                <p className="text-slate-600 text-sm mb-6">
                  {t("verifyEmail.success")}
                </p>
                <Link
                  href="/portal/login"
                  className="inline-flex px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
                >
                  {t("verifyEmail.loginCta")}
                </Link>
              </>
            )}

            {(status === "error" || status === "expired") && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
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
                  <Link
                    href="/portal/login"
                    className="inline-flex justify-center px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
                  >
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
