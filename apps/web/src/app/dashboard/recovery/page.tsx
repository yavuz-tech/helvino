"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { checkAuth, type AdminUser } from "@/lib/auth";
import { useI18n } from "@/i18n/I18nContext";
import { useStepUp } from "@/contexts/StepUpContext";
import { Clock, CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface RecoveryRequest {
  id: string;
  userType: string;
  userId: string;
  email: string;
  reason: string;
  status: string;
  requestedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  ip: string | null;
  userAgent: string | null;
}

export default function AdminRecoveryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { withStepUp } = useStepUp();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      const u = await checkAuth();
      if (!u) { router.push("/login"); return; }
      setUser(u);
    };
    verify();
  }, [router]);

  const loadRequests = useCallback(async () => {
    try {
      const url = filter === "all"
        ? `${API_URL}/internal/recovery/requests`
        : `${API_URL}/internal/recovery/requests?status=${filter}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (user) loadRequests();
  }, [user, filter, loadRequests]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    setMessage(null);
    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/recovery/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }),
      "admin"
    );
    if (result.cancelled) { setProcessingId(null); return; }
    if (result.ok) {
      const data = result.data as Record<string, unknown> | undefined;
      const mfaNote = data?.mfaReset ? ` (${t("recovery.admin.mfaReset")})` : "";
      setMessage({ type: "success", text: t("recovery.admin.approved") + mfaNote });
      loadRequests();
    } else {
      setMessage({ type: "error", text: "Failed to approve" });
    }
    setProcessingId(null);
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    setMessage(null);
    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/recovery/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason || "Rejected by admin" }),
      }),
      "admin"
    );
    if (result.cancelled) { setProcessingId(null); return; }
    if (result.ok) {
      setMessage({ type: "success", text: t("recovery.admin.rejected") });
      setRejectingId(null);
      setRejectReason("");
      loadRequests();
    } else {
      setMessage({ type: "error", text: "Failed to reject" });
    }
    setProcessingId(null);
  };

  const statusBadge = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock size={14} />,
      approved: <CheckCircle size={14} />,
      rejected: <XCircle size={14} />,
      expired: <AlertTriangle size={14} />,
    };
    const colors: Record<string, string> = {
      pending: "bg-amber-100 text-amber-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      expired: "bg-amber-50 text-amber-700",
    };
    const statusKey = `recovery.${status}` as Parameters<typeof t>[0];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.expired}`}>
        {icons[status]} {t(statusKey)}
      </span>
    );
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-[#475569]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1A1D23] font-heading">{t("recovery.admin.title")}</h1>
            <p className="text-sm text-[#475569]">{t("recovery.admin.description")}</p>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {message.text}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2">
          {["pending", "approved", "rejected", "expired", "all"].map((f) => {
            const label = f === "all" ? t("recovery.admin.all") : t(`recovery.${f}` as Parameters<typeof t>[0]);
            return (
              <button
                key={f}
                onClick={() => { setFilter(f); setLoading(true); }}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filter === f ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white" : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Requests */}
        {loading ? (
          <div className="text-sm text-[#64748B]">{t("common.loading")}</div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-lg border border-[#F3E8D8] p-8 text-center text-sm text-[#64748B]">
            {t("recovery.admin.noRequests")}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="bg-white rounded-lg border border-[#F3E8D8] p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {statusBadge(req.status)}
                    <span className="text-sm font-medium text-[#1A1D23]">{req.email}</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full">
                      {req.userType}
                    </span>
                  </div>
                    <span className="text-xs text-[#64748B]" suppressHydrationWarning>
                    {new Date(req.requestedAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-sm text-[#334155] mb-2">{req.reason}</p>

                <div className="flex gap-4 text-xs text-[#94A3B8] mb-3">
                  {req.ip && <span>IP: {req.ip}</span>}
                  <span suppressHydrationWarning>{t("recovery.expiresAt")}: {new Date(req.expiresAt).toLocaleString()}</span>
                  {req.resolvedBy && (
                    <span suppressHydrationWarning>{t("recovery.resolvedAt")}: {new Date(req.resolvedAt!).toLocaleString()} ({req.resolvedBy})</span>
                  )}
                </div>

                {req.status === "pending" && (
                      <div className="flex items-center gap-2 pt-2 border-t border-amber-100">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={processingId === req.id}
                      className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {processingId === req.id ? t("recovery.admin.approving") : t("recovery.admin.approve")}
                    </button>
                    {rejectingId === req.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t("recovery.admin.reason")}
                          className="flex-1 px-3 py-1.5 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20"
                          autoFocus
                        />
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={processingId === req.id}
                          className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {t("recovery.admin.reject")}
                        </button>
                        <button
                          onClick={() => { setRejectingId(null); setRejectReason(""); }}
                          className="px-3 py-1.5 text-sm text-[#475569] hover:text-amber-800"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRejectingId(req.id)}
                        className="px-4 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        {t("recovery.admin.reject")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
