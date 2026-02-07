"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Shield, ShieldCheck, Copy, Check } from "lucide-react";

interface MfaSetupSectionProps {
  mfaEnabled: boolean;
  mfaVerifiedAt: string | null;
  /** Called to start MFA setup. Returns otpauthUri, secret, backupCodes */
  onSetup: () => Promise<{ otpauthUri: string; secret: string; backupCodes: string[] } | null>;
  /** Called to verify the TOTP code during setup */
  onVerify: (code: string) => Promise<boolean>;
  /** Called to disable MFA */
  onDisable: (code: string) => Promise<boolean>;
  /** Called after MFA state changes */
  onRefresh: () => void;
}

export default function MfaSetupSection({
  mfaEnabled,
  mfaVerifiedAt,
  onSetup,
  onVerify,
  onDisable,
  onRefresh,
}: MfaSetupSectionProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "backup" | "disable">("idle");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartSetup = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await onSetup();
    if (result) {
      setOtpauthUri(result.otpauthUri);
      setSecretKey(result.secret);
      setBackupCodes(result.backupCodes);
      setStep("setup");
    } else {
      setError(t("common.error"));
    }
    setLoading(false);
  }, [onSetup, t]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    const success = await onVerify(code.trim());
    if (success) {
      setStep("backup");
      setCode("");
    } else {
      setError(t("mfa.invalidCode"));
    }
    setLoading(false);
  };

  const handleBackupDone = () => {
    setStep("idle");
    setBackupCodes([]);
    setOtpauthUri("");
    setSecretKey("");
    onRefresh();
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    const success = await onDisable(code.trim());
    if (success) {
      setStep("idle");
      setCode("");
      onRefresh();
    } else {
      setError(t("mfa.invalidCode"));
    }
    setLoading(false);
  };

  const copyAllCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate QR code URL using Google Charts API
  const qrUrl = otpauthUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`
    : "";

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-1">
        {mfaEnabled ? (
          <ShieldCheck size={20} className="text-green-600" />
        ) : (
          <Shield size={20} className="text-slate-400" />
        )}
        <h2 className="text-lg font-semibold text-slate-900">{t("mfa.title")}</h2>
      </div>
      <p className="text-sm text-slate-600 mb-4">{t("mfa.description")}</p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Idle state */}
      {step === "idle" && (
        <div>
          {mfaEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                  {t("mfa.enabled")}
                </span>
                {mfaVerifiedAt && (
                  <span className="text-xs text-slate-500" suppressHydrationWarning>
                    {t("mfa.enabledSince")}: {new Date(mfaVerifiedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setStep("disable"); setCode(""); setError(null); }}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm"
              >
                {t("mfa.disable")}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-sm px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                {t("mfa.disabled")}
              </span>
              <div>
                <button
                  onClick={handleStartSetup}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400 text-sm"
                >
                  {loading ? t("common.loading") : t("mfa.setup")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Setup: show QR + manual key */}
      {step === "setup" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-slate-700">{t("mfa.scanQr")}</p>
            {qrUrl && (
              <img src={qrUrl} alt="QR Code" width={200} height={200} className="rounded-lg border border-slate-200" />
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">{t("mfa.orEnterManually")}</p>
            <code className="block px-3 py-2 bg-slate-50 rounded border border-slate-200 text-sm font-mono break-all select-all">
              {secretKey}
            </code>
          </div>
          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("mfa.enterCode")}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-center text-lg tracking-widest"
                placeholder="000000"
                maxLength={6}
                autoFocus
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
            >
              {loading ? t("mfa.verifying") : t("mfa.verifyCode")}
            </button>
          </form>
        </div>
      )}

      {/* Backup codes */}
      {step === "backup" && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
            {t("mfa.setupComplete")}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">{t("mfa.backupCodes")}</h3>
            <p className="text-xs text-slate-600 mb-2">{t("mfa.backupCodesDesc")}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 font-medium mb-3">
              {t("mfa.backupCodesWarning")}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {backupCodes.map((bc, i) => (
                <code key={i} className="px-3 py-1.5 bg-slate-50 rounded border border-slate-200 text-sm font-mono text-center">
                  {bc}
                </code>
              ))}
            </div>
            <button
              onClick={copyAllCodes}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t("mfa.copied") : t("mfa.copyAll")}
            </button>
          </div>
          <button
            onClick={handleBackupDone}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            {t("common.close")}
          </button>
        </div>
      )}

      {/* Disable flow */}
      {step === "disable" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{t("mfa.disableConfirm")}</p>
          <form onSubmit={handleDisable} className="space-y-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("mfa.codeOrBackup")}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-center text-lg tracking-widest"
              autoFocus
              disabled={loading}
              maxLength={20}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep("idle"); setCode(""); setError(null); }}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                disabled={loading}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-300"
              >
                {loading ? t("mfa.disabling") : t("mfa.disable")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
