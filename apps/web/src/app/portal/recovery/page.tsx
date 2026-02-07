"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import { API_URL } from "@/lib/portal-auth";
import ErrorBanner from "@/components/ErrorBanner";
import { ShieldAlert, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface RecoveryRequest {
  id: string;
  status: string;
  reason: string;
  requestedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
}

export default function PortalRecoveryPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [statusEmail, setStatusEmail] = useState("");

  // Emergency token state
  const [emergencyToken, setEmergencyToken] = useState("");
  const [usingToken, setUsingToken] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState<string | null>(null);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);

  const loadStatus = useCallback(async (checkEmail: string) => {
    if (!checkEmail) return;
    try {
      const res = await fetch(
        `${API_URL}/portal/recovery/status?email=${encodeURIComponent(checkEmail)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (statusEmail) loadStatus(statusEmail);
  }, [statusEmail, loadStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/portal/recovery/request`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setError(t("recovery.tooMany"));
      } else if (res.status === 409) {
        setError(t("recovery.alreadyPending"));
      } else if (!res.ok) {
        setError(data.error || "Failed to submit");
      } else {
        setSuccess(t("recovery.submitted"));
        setStatusEmail(email);
        setReason("");
      }
    } catch {
      setError("Network error");
    }
    setSubmitting(false);
  };

  const handleUseEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsingToken(true);
    setEmergencyResult(null);
    setEmergencyError(null);

    try {
      const res = await fetch(`${API_URL}/portal/emergency/use`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: emergencyToken }),
      });

      const data = await res.json();

      if (res.status === 410) {
        setEmergencyError(data.error?.includes("already") ? t("emergency.alreadyUsed") : t("emergency.invalidToken"));
      } else if (!res.ok) {
        setEmergencyError(data.error || t("emergency.invalidToken"));
      } else {
        setEmergencyResult(t("emergency.success"));
        setEmergencyToken("");
      }
    } catch {
      setEmergencyError("Network error");
    }
    setUsingToken(false);
  };

  const statusBadge = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock size={14} className="text-amber-500" />,
      approved: <CheckCircle size={14} className="text-green-500" />,
      rejected: <XCircle size={14} className="text-red-500" />,
      expired: <AlertTriangle size={14} className="text-slate-400" />,
    };
    const colors: Record<string, string> = {
      pending: "bg-amber-50 text-amber-800 border-amber-200",
      approved: "bg-green-50 text-green-800 border-green-200",
      rejected: "bg-red-50 text-red-800 border-red-200",
      expired: "bg-slate-50 text-slate-600 border-slate-200",
    };
    const statusKey = `recovery.${status}` as Parameters<typeof t>[0];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] || colors.expired}`}>
        {icons[status]} {t(statusKey)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <ShieldAlert size={24} className="text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t("recovery.title")}</h1>
          <p className="text-sm text-slate-600 mt-1">{t("recovery.description")}</p>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
            {success}
          </div>
        )}

        {/* Recovery Request Form */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("recovery.emailLabel")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatusEmail(e.target.value); }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("recovery.reasonLabel")}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("recovery.reasonPlaceholder")}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 min-h-[80px]"
                required
                minLength={10}
                maxLength={1000}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !email || reason.length < 10}
              className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
            >
              {submitting ? t("recovery.submitting") : t("recovery.submit")}
            </button>
          </form>
        </div>

        {/* Previous Requests */}
        {requests.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">{t("recovery.status")}</h2>
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    {statusBadge(req.status)}
                    <span className="text-xs text-slate-500" suppressHydrationWarning>
                      {new Date(req.requestedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{req.reason}</p>
                  {req.resolvedAt && (
                    <p className="text-xs text-slate-500 mt-1" suppressHydrationWarning>
                      {t("recovery.resolvedAt")}: {new Date(req.resolvedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Token */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">{t("emergency.useToken")}</h2>
          <p className="text-sm text-slate-600 mb-4">{t("emergency.description")}</p>

          {emergencyResult && (
            <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
              {emergencyResult}
            </div>
          )}
          {emergencyError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
              {emergencyError}
            </div>
          )}

          <form onSubmit={handleUseEmergency} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t("emergency.tokenLabel")}
              </label>
              <input
                type="text"
                value={emergencyToken}
                onChange={(e) => setEmergencyToken(e.target.value)}
                placeholder={t("emergency.tokenPlaceholder")}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={usingToken || !emergencyToken}
              className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:bg-amber-300"
            >
              {usingToken ? t("emergency.using") : t("emergency.use")}
            </button>
          </form>
        </div>

        {/* Back to login */}
        <div className="text-center">
          <Link href="/portal/login" className="text-sm text-slate-600 hover:text-slate-900 underline">
            {t("common.login")}
          </Link>
        </div>
      </div>
    </div>
  );
}
