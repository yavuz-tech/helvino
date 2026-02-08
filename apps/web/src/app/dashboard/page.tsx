"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDebug } from "@/contexts/DebugContext";
import { useOrg } from "@/contexts/OrgContext";
import { apiFetch, setDebugLogger, getRequestId } from "@/utils/api";
import { SystemStatus } from "@/components/SystemStatus";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import MfaPolicyBanner from "@/components/MfaPolicyBanner";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import EmptyState from "@/components/EmptyState";
import SecurityBadges from "@/components/SecurityBadges";
import AdminWidgetHealthSummary from "@/components/AdminWidgetHealthSummary";
import AdminAuditSummary from "@/components/AdminAuditSummary";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import SectionTitle from "@/components/SectionTitle";
import { useI18n } from "@/i18n/I18nContext";
import { Activity, AlertTriangle, BarChart3, Users } from "lucide-react";

interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ConversationDetail extends Conversation {
  messages: Message[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { logRequest, socket, isMounted } = useDebug();
  const { selectedOrg, isLoading: orgLoading } = useOrg();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  
  // Conversation detail state
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  // MFA policy
  const [adminMfaRequired, setAdminMfaRequired] = useState(false);
  const [adminMfaEnabled, setAdminMfaEnabled] = useState(true); // default true to avoid flash

  // Widget health summary state (admin)
  interface WidgetSummaryData {
    totals: {
      orgsTotal: number; connectedOrgs: number;
      loadsTotal: number; failuresTotal: number; domainMismatchTotal: number;
      okCount: number; needsAttentionCount: number; notConnectedCount: number;
    };
    topByFailures: { orgKey: string; orgName: string; failuresTotal: number; loadsTotal: number; lastSeenAt: string | null }[];
    topByDomainMismatch: { orgKey: string; orgName: string; domainMismatchTotal: number; lastSeenAt: string | null }[];
    lastSeenDistribution: { never: number; lt1h: number; lt24h: number; lt7d: number; gte7d: number };
    requestId?: string;
  }
  const [widgetSummary, setWidgetSummary] = useState<WidgetSummaryData | null>(null);

  const API_URL_POLICY = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const totalRequests = widgetSummary?.totals.loadsTotal ?? 0;
  const totalFailures = widgetSummary?.totals.failuresTotal ?? 0;
  const totalDomainMismatch = widgetSummary?.totals.domainMismatchTotal ?? 0;
  const totalOrgs = widgetSummary?.totals.orgsTotal ?? 0;

  // Check authentication on mount
  useEffect(() => {
    const verifyAuth = async () => {
      const user = await checkAuth();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      setAdminMfaEnabled((user as AdminUser & { mfaEnabled?: boolean }).mfaEnabled ?? false);
      setAuthLoading(false);

      // Check MFA policy
      try {
        const res = await fetch(`${API_URL_POLICY}/internal/security/mfa-policy`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setAdminMfaRequired(data.adminMfaRequired ?? false);
        }
      } catch { /* ignore */ }

      // Load widget health summary (best-effort)
      try {
        const wRes = await fetch(`${API_URL_POLICY}/internal/metrics/widget-health-summary`, { credentials: "include" });
        if (wRes.ok) {
          const wData = await wRes.json();
          setWidgetSummary(wData);
        }
      } catch { /* ignore */ }
    };
    verifyAuth();
  }, [router, API_URL_POLICY]);

  // Set debug logger on mount
  useEffect(() => {
    setDebugLogger(logRequest);
  }, [logRequest]);

  // Handle logout
  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Fetch conversations from API
  const fetchConversations = useCallback(async () => {
    if (!selectedOrg) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setErrorRequestId(null);
      const response = await apiFetch("/conversations", {
        orgKey: selectedOrg.key,
      });
      
      if (!response.ok) {
        setErrorRequestId(getRequestId(response));
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setConversations(data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
      setError(t("dashboard.failedLoadConversations"));
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrg, t]);

  // Initial fetch on mount
  useEffect(() => {
    if (!isMounted) return;
    fetchConversations();
  }, [isMounted, fetchConversations]);

  // Reset selected conversation and reload when org changes
  useEffect(() => {
    if (!selectedOrg) return;
    
    setSelectedConversationId(null);
    setConversationDetail(null);
    fetchConversations();
  }, [selectedOrg, fetchConversations]);

  // Fetch conversation detail with messages
  const fetchConversationDetail = useCallback(async (conversationId: string) => {
    if (!selectedOrg) return;

    try {
      setIsLoadingDetail(true);
      const response = await apiFetch(`/conversations/${conversationId}`, {
        orgKey: selectedOrg.key,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setConversationDetail(data);
    } catch (err) {
      console.error("Failed to fetch conversation detail:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [selectedOrg]);

  // Select conversation
  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    fetchConversationDetail(conversationId);
  };

  // Send agent reply
  const sendReply = async () => {
    if (!selectedConversationId || !replyContent.trim() || isSending || !selectedOrg) return;

    const content = replyContent.trim();
    setReplyContent("");
    setIsSending(true);

    try {
      const response = await apiFetch(`/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        orgKey: selectedOrg.key,
        body: JSON.stringify({
          role: "assistant",
          content,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const message = await response.json();

      // Optimistic UI: Add to thread immediately
      setConversationDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, message],
        };
      });
    } catch (err) {
      console.error("Failed to send reply:", err);
      alert(t("dashboard.failedSendMessage"));
      setReplyContent(content); // Restore content on error
    } finally {
      setIsSending(false);
    }
  };

  // Listen to Socket.IO for real-time inbox + thread updates
  useEffect(() => {
    if (!socket || !isMounted) return;

    const handleNewMessage = (data: { conversationId: string; message: Message }) => {
      console.log("📨 Real-time update received:", data.conversationId);
      
      // Update conversation in inbox list
      setConversations((prev) => {
        const updated = prev.map((conv) => {
          if (conv.id === data.conversationId) {
            return {
              ...conv,
              updatedAt: data.message.timestamp,
              messageCount: conv.messageCount + 1,
            };
          }
          return conv;
        });
        
        // Re-sort by updatedAt (most recent first)
        return updated.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });

      // If this is the selected conversation, append to thread
      if (data.conversationId === selectedConversationId) {
        setConversationDetail((prev) => {
          if (!prev) return prev;
          
          // Prevent duplicates (optimistic UI may have already added it)
          const exists = prev.messages.some((m) => m.id === data.message.id);
          if (exists) return prev;
          
          return {
            ...prev,
            messages: [...prev.messages, data.message],
            messageCount: prev.messageCount + 1,
            updatedAt: data.message.timestamp,
          };
        });
      }
    };

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [socket, isMounted, selectedConversationId]);

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Short ID helper
  const shortId = (id: string) => {
    return id.substring(0, 12) + "...";
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#0F5C5C] animate-spin" />
      </div>
    );
  }

  // Show empty state if no org selected
  if (!selectedOrg && !orgLoading) {
    return (
      <DashboardLayout user={user} onLogout={handleLogout}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
              <span className="text-2xl">🏢</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">{t("dashboard.noOrgSelected")}</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              {t("dashboard.createFirstOrg")}
            </p>
            <Link
              href="/dashboard/orgs/new"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0F5C5C] text-white text-sm font-semibold rounded-xl hover:bg-[#0D4F4F] transition-all duration-150 shadow-[0_1px_3px_rgba(15,92,92,0.2)]"
            >
              {t("nav.createOrg")}
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <OnboardingOverlay area="admin" />
      {adminMfaRequired && !adminMfaEnabled && (
        <MfaPolicyBanner blocking={true} securityUrl="/dashboard/settings" />
      )}
      <PageHeader
        title={t("nav.overview")}
        subtitle={t("dashboard.metricsLast60s")}
        action={<SecurityBadges mfaEnabled={adminMfaEnabled} auditActive={true} />}
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard title={t("dashboard.totalRequests")} value={String(totalRequests)} icon={BarChart3} gradient="from-[#0F5C5C] to-[#1E88A8]" />
        <StatCard title={t("dashboard.errors5xx")} value={String(totalFailures)} icon={AlertTriangle} gradient="from-[#0F5C5C] to-[#1E88A8]" />
        <StatCard title={t("dashboard.rateLimited")} value={String(totalDomainMismatch)} icon={Activity} gradient="from-[#0F5C5C] to-[#1E88A8]" />
        <StatCard title={t("orgDir.totalOrgs")} value={String(totalOrgs)} icon={Users} gradient="from-[#0F5C5C] to-[#1E88A8]" />
      </div>

      <div className="mb-8">
        <Card variant="elevated" padding="lg">
          <SectionTitle title={t("dashboard.systemStatus")} />
          <SystemStatus />
        </Card>
      </div>

      {/* Widget Health Summary */}
      {widgetSummary && (
        <Card variant="elevated" padding="lg" className="mb-8">
          <AdminWidgetHealthSummary data={widgetSummary} />
        </Card>
      )}

      {/* Audit Summary (24h) */}
      <Card variant="outlined" padding="lg" className="mb-8">
        <AdminAuditSummary />
      </Card>

      <div className="flex gap-5 h-[calc(100vh-16rem)]">
        {/* Left: Inbox List */}
        <div className="w-96 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(15,92,92,0.08)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/60 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("dashboard.inbox")} ({conversations.length})
              </h2>
              <button
                onClick={fetchConversations}
                disabled={isLoading}
                className="text-[11px] text-slate-400 hover:text-slate-900 disabled:text-slate-300 transition-colors duration-150 font-medium"
              >
                {isLoading ? t("common.loading") : `↻ ${t("common.refresh")}`}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="px-5 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
                {error}
                {errorRequestId && (
                  <span className="block text-xs text-red-400 font-mono mt-1">
                    Request ID: {errorRequestId}
                  </span>
                )}
              </div>
            )}

            {isLoading && conversations.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-[#0F5C5C] animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                icon="📭"
                title={t("empty.conversations")}
                description={t("empty.conversationsDesc")}
              />
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`px-5 py-3.5 cursor-pointer transition-all duration-150 border-l-[3px] border-b border-b-slate-100 ${
                    selectedConversationId === conv.id
                      ? "bg-[#0F5C5C]/[0.04] border-l-[#0F5C5C]"
                      : "border-l-transparent hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <code className="text-[11px] font-mono text-slate-800 font-medium">
                      {shortId(conv.id)}
                    </code>
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded-md text-[10px] font-semibold text-slate-600">
                      {conv.messageCount}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400" suppressHydrationWarning>
                    {formatDate(conv.updatedAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Conversation Detail */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(15,92,92,0.08)] overflow-hidden">
          {!selectedConversationId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">💬</span>
                </div>
                <p className="text-sm text-slate-400">{t("dashboard.selectConversation")}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {isLoadingDetail ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-[#0F5C5C] animate-spin" />
                  </div>
                ) : conversationDetail ? (
                  conversationDetail.messages.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 text-sm">
                      {t("dashboard.noMessages")}
                    </div>
                  ) : (
                    conversationDetail.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                            msg.role === "user"
                              ? "bg-[#0F5C5C] text-white"
                              : "bg-slate-50 text-slate-800 border border-slate-200/60"
                          }`}
                        >
                          <div className="mb-1 leading-relaxed">{msg.content}</div>
                          <div className={`text-[10px] ${msg.role === "user" ? "text-white/60" : "text-slate-400"}`} suppressHydrationWarning>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : null}
              </div>

              {/* Agent Reply Box */}
              <div className="border-t border-slate-200/60 p-4 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder={t("dashboard.typeReply")}
                    disabled={isSending}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#0F5C5C] focus:ring-2 focus:ring-[#0F5C5C]/10 disabled:bg-slate-50 transition-all duration-150"
                  />
                  <button
                    onClick={sendReply}
                    disabled={isSending || !replyContent.trim()}
                    className="bg-[#0F5C5C] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0D4F4F] transition-all duration-150 disabled:opacity-50 shadow-[0_1px_2px_rgba(15,92,92,0.2)]"
                  >
                    {isSending ? t("common.sending") : t("common.send")}
                  </button>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-400">
                  {t("dashboard.pressEnter")}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
