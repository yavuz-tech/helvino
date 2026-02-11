"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import {
  markPortalOnboardingDeferredForSession,
  portalApiFetch,
} from "@/lib/portal-auth";

const displayFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });
const bodyFont = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

export default function PortalSecurityOnboardingPage() {
  const { t } = useI18n();
  const { user, loading } = usePortalAuth();
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/portal/login");
    }
  }, [loading, user, router]);


  const vars = useMemo(
    () =>
      ({
        "--onb-primary": "#1A1D23",
        "--onb-accent": "#F59E0B",
        "--onb-highlight": "#FB7185",
        "--onb-bg-a": "#FFFBEB",
        "--onb-bg-b": "#FEF3C7",
        "--onb-bg-c": "#FDE68A",
        "--onb-glow": "rgba(245, 158, 11, 0.25)",
      }) as React.CSSProperties,
    []
  );

  const goWithExit = (target: string) => {
    setIsClosing(true);
    window.setTimeout(() => {
      router.push(target);
    }, 240);
  };

  const handleEnableMfa = () => {
    goWithExit("/portal/mfa-setup");
  };

  const handleLater = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const endpoint = dontShowAgain
        ? "/api/portal/security-onboarding/dismiss"
        : "/api/portal/security-onboarding/continue";
      const res = await portalApiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ dontShowAgain }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && typeof data.error === "string" ? data.error : null) || t("common.error"));
        setIsBusy(false);
        return;
      }
      // If user didn't permanently dismiss, skip only for this browser session.
      if (!dontShowAgain) {
        markPortalOnboardingDeferredForSession();
      }
      // Hard redirect prevents stale auth context from bouncing back to onboarding.
      window.location.href = "/portal";
    } catch {
      setError(t("common.networkError"));
      setIsBusy(false);
    }
  };


  if (loading) {
    return (
      <div className={`${bodyFont.className} min-h-screen bg-[var(--onb-bg-a)] text-[var(--onb-primary)]`} style={vars}>
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="rounded-xl border border-amber-200/70 bg-white/75 px-5 py-3 text-sm text-[var(--onb-primary)]">{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`${bodyFont.className} min-h-screen bg-[var(--onb-bg-a)] text-[var(--onb-primary)]`} style={vars}>
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="rounded-xl border border-amber-200/70 bg-white/75 px-5 py-3 text-sm text-[var(--onb-primary)]">{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bodyFont.className} relative min-h-screen overflow-hidden text-[var(--onb-primary)]`} style={vars}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(251, 113, 133, 0.15), transparent 50%), linear-gradient(135deg, var(--onb-bg-a) 0%, var(--onb-bg-b) 55%, var(--onb-bg-c) 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#1A1D23_0.6px,transparent_0.6px)] [background-size:3px_3px]" />

      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.985 }}
        animate={{ opacity: isClosing ? 0 : 1, y: isClosing ? -8 : 0, scale: isClosing ? 0.985 : 1 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="relative z-10 mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10 sm:px-6"
      >
        <div className="w-full max-w-2xl rounded-xl border border-amber-200/70 bg-white/45 p-1 shadow-[0_28px_70px_rgba(149,115,22,0.26)] backdrop-blur-md">
          <div className="relative overflow-hidden rounded-[11px] border border-amber-100/80 bg-white/70 px-6 py-7 sm:px-9 sm:py-10">
            <div className="pointer-events-none absolute -right-14 -top-12 h-36 w-36 rounded-full bg-[var(--onb-glow)] blur-3xl" />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="mb-7 flex items-start justify-between gap-6"
            >
              <div>
                <p className="mb-3 inline-flex rounded-md border border-amber-300/70 bg-amber-100/80 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-800">
                  {t("securityOnboarding.badge")}
                </p>
                <h1 className={`${displayFont.className} text-3xl font-semibold tracking-tight text-[var(--onb-primary)] sm:text-4xl`}>
                  {t("securityOnboarding.title")}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-700 sm:text-base">
                  {t("securityOnboarding.subtitle")}
                </p>
              </div>

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                className="hidden shrink-0 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-[var(--onb-accent)] sm:block"
                aria-hidden
              >
                <ShieldCheck size={28} />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="mb-6 rounded-lg border border-amber-200/70 bg-white/75 p-4"
            >
              <p className="text-sm leading-relaxed text-slate-700">{t("securityOnboarding.body")}</p>
            </motion.div>

            {error ? (
              <div className="mb-4 rounded-lg border border-rose-300/65 bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              className="flex flex-col gap-3"
            >
              <div className="rounded-lg border border-amber-200/70 bg-white/70 px-3 py-2.5">
                <label className="inline-flex items-start gap-3 text-sm leading-5 text-slate-700">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(event) => setDontShowAgain(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-amber-300 bg-white text-amber-500 focus:ring-amber-300/50"
                  />
                  <span className="text-slate-700">{t("mfa.dontShowAgain")}</span>
                </label>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
              <motion.button
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={handleEnableMfa}
                disabled={isBusy}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-[#1A1D23] shadow-[0_12px_30px_rgba(245,158,11,0.34)] transition hover:brightness-105 disabled:opacity-60"
              >
                {t("securityOnboarding.primaryCta")}
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={handleLater}
                disabled={isBusy}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-rose-200/75 bg-rose-50/70 px-4 py-3 text-sm font-semibold text-[var(--onb-highlight)] transition hover:bg-rose-100/70 disabled:opacity-60"
              >
                {isBusy ? t("common.loading") : t("securityOnboarding.secondaryCta")}
              </motion.button>
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="mt-4 text-center text-xs text-slate-600"
            >
              {t("securityOnboarding.footerNote")}
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
