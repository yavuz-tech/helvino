"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nContext";
import { API_URL } from "@/lib/portal-auth";
import ErrorBanner from "@/components/ErrorBanner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";

function PortalRecoveryContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emergencyToken, setEmergencyToken] = useState("");
  const [usingToken, setUsingToken] = useState(false);
  const [autoUnlocking, setAutoUnlocking] = useState(false);

  const tryUnlock = async (tokenValue: string) => {
    if (!tokenValue.trim()) {
      setError(t("portalLogin.unlockTokenRequired"));
      return;
    }
    setUsingToken(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/portal/emergency/use`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenValue.trim() }),
      });

      const data = await res.json();

      if (res.status === 410) {
        setError(data.error?.includes("already") ? t("emergency.alreadyUsed") : t("emergency.invalidToken"));
      } else if (!res.ok) {
        setError(data.error || t("emergency.invalidToken"));
      } else {
        setSuccess(true);
        setEmergencyToken("");
        window.setTimeout(() => {
          router.push("/portal/login");
        }, 1600);
      }
    } catch {
      setError(t("common.networkError"));
    }
    setUsingToken(false);
  };

  useEffect(() => {
    const tokenFromQuery = searchParams.get("token");
    if (!tokenFromQuery) return;
    setEmergencyToken(tokenFromQuery);
    setAutoUnlocking(true);
    void tryUnlock(tokenFromQuery).finally(() => setAutoUnlocking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    await tryUnlock(emergencyToken);
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
              {success ? (
                <motion.div
                  className="space-y-3 text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{t("recovery.unlockTitle")}</h2>
                  <p className="text-sm text-emerald-700">{t("recovery.unlockSuccess")}</p>
                </motion.div>
              ) : (
                <>
                  <div className="mb-4 text-center">
                    <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-400 shadow-[0_10px_24px_rgba(245,158,11,0.35)]">
                      <LockKeyhole className="h-7 w-7 text-[var(--primary)]" />
                    </div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">{t("recovery.unlockTitle")}</h1>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("recovery.unlockBody")}</p>
                    {autoUnlocking ? (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">{t("recovery.autoUnlocking")}</p>
                    ) : null}
                  </div>

                  {error ? (
                    <ErrorBanner
                      message={error}
                      onDismiss={() => setError(null)}
                      className="mb-4"
                    />
                  ) : null}

                  <form onSubmit={handleUseEmergency} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        {t("emergency.tokenLabel")}
                      </label>
                      <input
                        type="text"
                        value={emergencyToken}
                        onChange={(e) => setEmergencyToken(e.target.value)}
                        placeholder={t("emergency.tokenPlaceholder")}
                        className="w-full rounded-xl border border-amber-200/70 bg-[var(--bg-glass)] px-3.5 py-2.5 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                        disabled={usingToken}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={usingToken || !emergencyToken}
                      className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {usingToken ? t("recovery.unlocking") : t("recovery.unlockButton")}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-2 text-center">
            <Link
              href="/portal/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--highlight)] transition-opacity hover:opacity-80"
            >
              <ArrowLeft size={14} />
              <span>{t("security.backToLogin")}</span>
            </Link>
            <div>
              <Link
                href="/contact"
                className="text-sm font-medium text-[var(--text-secondary)] underline decoration-dotted underline-offset-2 hover:text-[var(--text-primary)]"
              >
                {t("recovery.contactSupportCta")}
              </Link>
            </div>
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}

export default function PortalRecoveryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
          <div className="text-[#64748B]">Loading...</div>
        </div>
      }
    >
      <PortalRecoveryContent />
    </Suspense>
  );
}
