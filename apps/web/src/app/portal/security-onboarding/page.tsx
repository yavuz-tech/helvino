"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { portalApiFetch } from "@/lib/portal-auth";

const displayFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });
const bodyFont = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

export default function PortalSecurityOnboardingPage() {
  const { t } = useI18n();
  const { user, loading } = usePortalAuth();
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vars = useMemo(
    () =>
      ({
        "--onb-bg-a": "#08172D",
        "--onb-bg-b": "#102642",
        "--onb-bg-c": "#0B3A50",
        "--onb-accent": "#D4AF37",
        "--onb-glow": "rgba(212, 175, 55, 0.22)",
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
      const res = await portalApiFetch("/api/portal/security-onboarding/dismiss", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setError(t("common.error"));
        setIsBusy(false);
        return;
      }
      goWithExit("/portal");
    } catch {
      setError(t("common.networkError"));
      setIsBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={`${bodyFont.className} min-h-screen bg-slate-950 text-slate-100`}>
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm">{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={`${bodyFont.className} relative min-h-screen overflow-hidden text-slate-100`} style={vars}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 18%, rgba(16,72,120,.35), transparent 42%), radial-gradient(circle at 88% 76%, rgba(212,175,55,.14), transparent 45%), linear-gradient(140deg, var(--onb-bg-a) 0%, var(--onb-bg-b) 45%, var(--onb-bg-c) 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#fff_0.6px,transparent_0.6px)] [background-size:3px_3px]" />

      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.985 }}
        animate={{ opacity: isClosing ? 0 : 1, y: isClosing ? -8 : 0, scale: isClosing ? 0.985 : 1 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="relative z-10 mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10 sm:px-6"
      >
        <div className="w-full max-w-2xl rounded-xl border border-white/15 bg-white/10 p-1 shadow-[0_35px_90px_rgba(2,6,23,0.5)] backdrop-blur-md">
          <div className="relative overflow-hidden rounded-[11px] border border-white/10 bg-slate-950/45 px-6 py-7 sm:px-9 sm:py-10">
            <div className="pointer-events-none absolute -right-14 -top-12 h-36 w-36 rounded-full bg-[var(--onb-glow)] blur-3xl" />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="mb-7 flex items-start justify-between gap-6"
            >
              <div>
                <p className="mb-3 inline-flex rounded-md border border-amber-300/35 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-200">
                  {t("securityOnboarding.badge")}
                </p>
                <h1 className={`${displayFont.className} text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl`}>
                  {t("securityOnboarding.title")}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-200/90 sm:text-base">
                  {t("securityOnboarding.subtitle")}
                </p>
              </div>

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                className="hidden shrink-0 rounded-xl border border-white/20 bg-white/10 p-3 text-amber-300 sm:block"
                aria-hidden
              >
                <ShieldCheck size={28} />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="mb-6 rounded-lg border border-white/15 bg-white/5 p-4"
            >
              <p className="text-sm leading-relaxed text-slate-200">{t("securityOnboarding.body")}</p>
            </motion.div>

            {error ? (
              <div className="mb-4 rounded-lg border border-rose-300/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <motion.button
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={handleEnableMfa}
                disabled={isBusy}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(6,182,212,0.35)] transition disabled:opacity-60"
              >
                {t("securityOnboarding.primaryCta")}
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={handleLater}
                disabled={isBusy}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/15 disabled:opacity-60"
              >
                {isBusy ? t("common.loading") : t("securityOnboarding.secondaryCta")}
              </motion.button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="mt-4 text-center text-xs text-slate-300/90"
            >
              {t("securityOnboarding.footerNote")}
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
