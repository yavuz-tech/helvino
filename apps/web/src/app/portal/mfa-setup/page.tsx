"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { CheckCircle2, Download, KeyRound, QrCode, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch, storePortalRefreshToken } from "@/lib/portal-auth";

interface SetupResponse {
  ok: boolean;
  otpauthUri: string;
  qrCodeDataUrl?: string | null;
  secret: string;
  backupCodes: string[];
}

type SetupStep = 1 | 2 | 3;

const displayFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });
const bodyFont = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

const CODE_LENGTH = 6;

function PortalMfaSetupInner() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupToken = searchParams.get("setupToken") || "";
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [step, setStep] = useState<SetupStep>(1);
  const [showManualSecret, setShowManualSecret] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(Array.from({ length: CODE_LENGTH }, () => ""));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);
  const hasAutoRequested = useRef(false);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const fullCode = codeDigits.join("");
  const isCodeComplete = codeDigits.every((digit) => digit.length === 1);
  const stepItems = [
    { id: 1 as SetupStep, label: t("mfa.stepScan"), icon: QrCode },
    { id: 2 as SetupStep, label: t("mfa.stepVerify"), icon: ShieldCheck },
    { id: 3 as SetupStep, label: t("mfa.stepBackup"), icon: KeyRound },
  ];

  const vars = useMemo(
    () =>
      ({
        "--mfa-bg-a": "#08172D",
        "--mfa-bg-b": "#102642",
        "--mfa-bg-c": "#0B3A50",
        "--mfa-accent": "#D4AF37",
        "--mfa-glow": "rgba(212, 175, 55, 0.2)",
      }) as React.CSSProperties,
    []
  );

  const startSetup = useCallback(async () => {
    setLoadingSetup(true);
    setError(null);
    try {
      const res = await portalApiFetch("/portal/security/mfa/setup", {
        method: "POST",
        headers: setupToken ? { "x-mfa-setup-token": setupToken } : undefined,
        body: JSON.stringify(setupToken ? { setupToken } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/portal/login");
          return;
        }
        setError(data?.error || t("common.error"));
        return;
      }
      setSetup(data);
      setStep(1);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoadingSetup(false);
    }
  }, [setupToken, t]);

  useEffect(() => {
    // Auto-load QR immediately on page open.
    if (!hasAutoRequested.current && !setup && !loadingSetup) {
      hasAutoRequested.current = true;
      void startSetup();
    }
  }, [setup, loadingSetup, startSetup]);

  const verify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await portalApiFetch("/portal/security/mfa/verify", {
        method: "POST",
        headers: setupToken ? { "x-mfa-setup-token": setupToken } : undefined,
        body: JSON.stringify({ code: fullCode, ...(setupToken ? { setupToken } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || t("mfa.invalidCode"));
        return;
      }
      if (data?.refreshToken) {
        storePortalRefreshToken(data.refreshToken);
      }
      setVerified(true);
      setStep(3);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setVerifying(false);
    }
  };

  const updateDigit = (index: number, rawValue: string) => {
    const clean = rawValue.replace(/\D/g, "");
    const next = [...codeDigits];
    next[index] = clean.slice(-1);
    setCodeDigits(next);
    if (clean && index < CODE_LENGTH - 1) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const onDigitKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !codeDigits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      codeRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      codeRefs.current[index + 1]?.focus();
    }
  };

  const onPasteCode = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH)
      .split("");
    if (pasted.length === 0) return;
    const next = Array.from({ length: CODE_LENGTH }, (_, index) => pasted[index] || "");
    setCodeDigits(next);
    const focusIndex = Math.min(pasted.length, CODE_LENGTH) - 1;
    codeRefs.current[Math.max(focusIndex, 0)]?.focus();
  };

  const copyAllCodes = async () => {
    if (!setup?.backupCodes.length) return;
    await navigator.clipboard.writeText(setup.backupCodes.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadCodes = () => {
    if (!setup?.backupCodes.length) return;
    const blob = new Blob([`${t("mfa.backupCodes")}\n\n${setup.backupCodes.join("\n")}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "helvino-mfa-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const completeSetup = () => {
    setFinalizing(true);
    window.setTimeout(() => {
      router.push("/portal");
    }, 520);
  };

  const skipForNow = async () => {
    setSkipping(true);
    setError(null);
    try {
      const endpoint = dontShowAgain
        ? "/api/portal/security-onboarding/dismiss"
        : "/api/portal/security-onboarding/continue";
      const res = await portalApiFetch(endpoint, {
        method: "POST",
        headers: setupToken ? { "x-mfa-setup-token": setupToken } : undefined,
        body: JSON.stringify(setupToken ? { setupToken } : {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/portal/login");
          return;
        }
        setError(data?.error || t("common.error"));
        setSkipping(false);
        return;
      }
      if (data?.refreshToken) {
        storePortalRefreshToken(data.refreshToken);
      }
      router.push("/portal");
    } catch {
      setError(t("common.networkError"));
      setSkipping(false);
    }
  };

  return (
    <div className={`${bodyFont.className} relative min-h-screen overflow-hidden text-slate-100`} style={vars}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 14% 18%, rgba(16,72,120,.35), transparent 42%), radial-gradient(circle at 86% 76%, rgba(212,175,55,.14), transparent 44%), linear-gradient(140deg, var(--mfa-bg-a) 0%, var(--mfa-bg-b) 45%, var(--mfa-bg-c) 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#fff_0.6px,transparent_0.6px)] [background-size:3px_3px]" />

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.988 }}
        animate={{ opacity: finalizing ? 0 : 1, y: finalizing ? -10 : 0, scale: finalizing ? 0.988 : 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="relative z-10 mx-auto flex min-h-screen max-w-5xl items-center justify-center px-3 py-3 sm:px-4 sm:py-4"
      >
        <div className="w-full max-w-xl rounded-xl border border-white/15 bg-white/10 p-1 shadow-[0_35px_90px_rgba(2,6,23,0.5)] backdrop-blur-md">
          <div className="relative overflow-hidden rounded-[11px] border border-white/10 bg-slate-950/45 px-4 py-4 sm:px-5 sm:py-5">
            <div className="pointer-events-none absolute -right-14 -top-12 h-36 w-36 rounded-full bg-[var(--mfa-glow)] blur-3xl" />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.35 }}
              className="mb-4"
            >
              <p className="mb-2 inline-flex rounded-md border border-amber-300/35 bg-amber-300/10 px-2 py-1 text-[11px] font-semibold tracking-wide text-amber-200">
                {t("mfa.premiumSetupBadge")}
              </p>
              <h1 className={`${displayFont.className} text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl`}>
                {t("mfa.setupFlowTitle")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">{t("mfa.setupFlowSubtitle")}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.35 }}
              className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-white/15 bg-white/5 p-1.5"
            >
              {stepItems.map(({ id, label, icon: Icon }) => (
                <div
                  key={id}
                  className={`rounded-md px-2 py-1.5 text-center text-[11px] font-semibold transition ${
                    step === id ? "bg-cyan-400/20 text-cyan-100" : "text-slate-300/80"
                  }`}
                >
                  <div className="mb-1 flex justify-center">
                    <Icon size={14} />
                  </div>
                  <span>{label}</span>
                </div>
              ))}
            </motion.div>

            {error ? (
              <div className="mb-5 rounded-lg border border-rose-300/45 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="rounded-lg border border-white/15 bg-white/5 p-3 sm:p-4"
            >
              {step === 1 ? (
                <div className="space-y-3">
                  <div>
                    <h2 className={`${displayFont.className} text-lg font-semibold text-slate-50`}>{t("mfa.stepScan")}</h2>
                    <p className="mt-1 text-sm text-slate-200/90">{t("mfa.scanStepHint")}</p>
                  </div>

                  {loadingSetup ? (
                    <div className="flex h-48 items-center justify-center rounded-lg border border-white/15 bg-slate-900/30">
                      <div className="inline-flex items-center gap-2 text-sm text-slate-100">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-200/60 border-t-transparent" />
                        {t("mfa.qrLoading")}
                      </div>
                    </div>
                  ) : setup?.qrCodeDataUrl ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28 }}>
                      <div className="flex justify-center">
                        <div className="rounded-xl border border-white/15 bg-white p-3 shadow-xl">
                          <img src={setup.qrCodeDataUrl} alt={t("mfa.scanQr")} className="h-44 w-44 rounded-md sm:h-48 sm:w-48" />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-3 text-sm text-amber-100">
                      <p className="font-semibold">{t("mfa.qrUnavailableTitle")}</p>
                      <p className="text-amber-100/90">{t("mfa.qrUnavailableDesc")}</p>
                      {setup?.otpauthUri ? (
                        <a
                          href={setup.otpauthUri}
                          className="inline-flex items-center justify-center rounded-md border border-amber-200/50 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-200/20"
                        >
                          {t("mfa.openAuthenticator")}
                        </a>
                      ) : null}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setShowManualSecret((prev) => !prev)}
                      className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      {showManualSecret ? t("mfa.hideManualKey") : t("mfa.manualKey")}
                    </button>
                    {showManualSecret && setup?.secret ? (
                      <code className="block rounded-md border border-white/15 bg-slate-900/35 px-3 py-2 text-center text-sm tracking-wide text-slate-100">
                        {setup.secret}
                      </code>
                    ) : null}
                    <button
                      type="button"
                      disabled={!setup || loadingSetup}
                      onClick={() => setStep(2)}
                      className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(6,182,212,0.35)] transition hover:brightness-105 disabled:opacity-60"
                    >
                      {t("mfa.nextStep")}
                    </button>
                    <button
                      type="button"
                      onClick={skipForNow}
                      disabled={skipping}
                      className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-slate-900/35 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-900/50 disabled:opacity-60"
                    >
                      {skipping ? t("mfa.skippingForNow") : t("mfa.skipForNow")}
                    </button>
                    <div className="rounded-lg border border-white/15 bg-slate-900/25 px-3 py-2.5">
                      <label className="inline-flex items-start gap-3 text-sm leading-5 text-slate-100">
                        <input
                          type="checkbox"
                          checked={dontShowAgain}
                          onChange={(event) => setDontShowAgain(event.target.checked)}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/40 bg-slate-900/60 text-cyan-400 focus:ring-cyan-300/40"
                        />
                        <span className="text-slate-100">{t("mfa.dontShowAgain")}</span>
                      </label>
                    </div>
                    {!setup?.qrCodeDataUrl ? (
                      <button
                        type="button"
                        onClick={() => void startSetup()}
                        disabled={loadingSetup}
                        className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        {loadingSetup ? t("mfa.qrLoading") : t("common.retry")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3">
                  <div>
                    <h2 className={`${displayFont.className} text-lg font-semibold text-slate-50`}>{t("mfa.stepVerify")}</h2>
                    <p className="mt-1 text-sm text-slate-200/90">{t("mfa.verifyStepHint")}</p>
                  </div>

                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {Array.from({ length: CODE_LENGTH }, (_, index) => (
                      <input
                        key={`digit-${index}`}
                        ref={(element) => {
                          codeRefs.current[index] = element;
                        }}
                        value={codeDigits[index]}
                        onChange={(event) => updateDigit(index, event.target.value)}
                        onKeyDown={(event) => onDigitKeyDown(index, event)}
                        onPaste={onPasteCode}
                        inputMode="numeric"
                        maxLength={1}
                        autoFocus={index === 0}
                        aria-label={`${t("mfa.enterCode")} ${index + 1}`}
                        className="h-10 w-10 rounded-lg border border-white/20 bg-slate-900/30 text-center text-base font-semibold text-slate-50 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30 sm:h-11 sm:w-11"
                      />
                    ))}
                  </div>

                  <p className="text-center text-xs text-slate-300/80">{t("mfa.codePlaceholder")}</p>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      {t("common.back")}
                    </button>
                    <button
                      type="button"
                      onClick={verify}
                      disabled={!isCodeComplete || verifying}
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(6,182,212,0.35)] transition hover:brightness-105 disabled:opacity-60"
                    >
                      {verifying ? t("mfa.verifying") : t("mfa.verifyCode")}
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-3">
                  <div>
                    <h2 className={`${displayFont.className} text-lg font-semibold text-slate-50`}>{t("mfa.stepBackup")}</h2>
                    <p className="mt-1 text-sm text-slate-200/90">{t("mfa.backupStepHint")}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {setup?.backupCodes.map((item) => (
                      <code
                        key={item}
                        className="rounded-md border border-white/20 bg-slate-900/35 px-2.5 py-1.5 text-center text-xs tracking-wide text-slate-100"
                      >
                        {item}
                      </code>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={copyAllCodes}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      {copied ? <CheckCircle2 size={16} /> : null}
                      {copied ? t("mfa.copiedBackupCodes") : t("mfa.copyAll")}
                    </button>
                    <button
                      type="button"
                      onClick={downloadCodes}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      <Download size={16} />
                      {t("mfa.downloadBackupCodes")}
                    </button>
                  </div>

                  <motion.button
                    whileHover={{ y: -1, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={completeSetup}
                    disabled={finalizing || !verified}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(6,182,212,0.35)] transition disabled:opacity-60"
                  >
                    {finalizing ? t("mfa.finishingSetup") : t("mfa.completeSetupButton")}
                  </motion.button>

                  {verified ? (
                    <div className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                      {t("mfa.setupComplete")}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function PortalMfaSetupPage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
          <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-100 backdrop-blur-sm">
            {t("mfa.qrLoading")}
          </div>
        </div>
      }
    >
      <PortalMfaSetupInner />
    </Suspense>
  );
}
