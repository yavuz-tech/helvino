"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/.translations-compat";
import ErrorBanner from "@/components/ErrorBanner";
import { useHydrated } from "@/hooks/useHydrated";
import { usePortalInboxNotification } from "@/contexts/PortalInboxNotificationContext";
import Link from "next/link";
import {
  Search, Send, User,
  MessageSquare, Paperclip, Smile,
  ArrowLeft, PanelRightOpen, PanelRightClose,
  Copy, CheckCircle, Bot, Sparkles,
  Lock, Wand2, FileText, CheckSquare, Square, X,
  AlertCircle, Star, Tag,
} from "lucide-react";
import UpgradeModal from "@/components/UpgradeModal";
import { premiumToast } from "@/components/PremiumToast";

/* ─── types ─── */
interface ConversationListItem {
  id: string;
  status: string;
  assignedToOrgUserId: string | null;
  assignedTo: { id: string; email: string; role: string } | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageAt: string;
  noteCount: number;
  hasUnreadMessages?: boolean;
  preview: { text: string; from: string } | null;
  slaStatus?: "ok" | "warning" | "breached" | null;
  slaDueAt?: string | null;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ConversationDetail {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status?: string;
  assignedTo?: { id: string; email: string; role: string } | null;
  closedAt?: string | null;
  messages: Message[];
}

interface Note {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; email: string; role: string };
}

interface TeamMember {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
}

type MobileView = "list" | "chat" | "details";

/* ─── helpers ─── */
function getInitials(str: string): string {
  const parts = str.split(/[@.\s]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.substring(0, 2).toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-teal-500 to-emerald-600",
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-600",
];
function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `bg-gradient-to-br ${AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]}`;
}

function formatTime(dateStr: string, hydrated: boolean): string {
  if (!hydrated) return dateStr.replace("T", " ").slice(11, 16);
  try { return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return dateStr.slice(11, 16); }
}

function formatDateTime(dateStr: string, hydrated: boolean): string {
  if (!hydrated) return dateStr.replace("T", " ").slice(0, 16);
  try {
    const d = new Date(dateStr);
    const mo = d.toLocaleString("en", { month: "short" });
    return `${mo} ${d.getDate()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return dateStr.slice(0, 16); }
}

function displayName(conv: ConversationListItem, t: (key: string) => string): string {
  if (conv.preview?.from && conv.preview.from !== "assistant") return conv.preview.from;
  return t("common.visitorNumber").replace("{id}", conv.id.substring(0, 6));
}

/** Sort conversations: unread first, then by updatedAt descending */
function sortConversations(list: ConversationListItem[]): ConversationListItem[] {
  return [...list].sort((a, b) => {
    // Unread first
    const ua = a.hasUnreadMessages ? 1 : 0;
    const ub = b.hasUnreadMessages ? 1 : 0;
    if (ub !== ua) return ub - ua;
    // Then by updatedAt descending
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function formatRelativeTime(dateStr: string, t: (key: string) => string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("common.time.now");
    if (mins < 60) return `${mins}${t("common.time.minuteShort")}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t("common.time.hourShort")}`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}${t("common.time.dayShort")}`;
    const weeks = Math.floor(days / 7);
    return `${weeks}${t("common.time.weekShort")}`;
  } catch { return ""; }
}

/* ═══════════════════════════════════════════════════════════════ */
export default function PortalInboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const hydrated = useHydrated();
  const { user, loading: authLoading } = usePortalAuth();

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters — default Unassigned so new messages (OPEN + unassigned) show there, not under Solved
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [assignedFilter, setAssignedFilter] = useState<"any" | "me" | "unassigned">("unassigned");
  const [unreadOnly, setUnreadOnly] = useState(() => searchParams.get("unread") === "1");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Selected
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Reply (agent message)
  const [replyBody, setReplyBody] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Team
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Panels
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [detailTab, setDetailTab] = useState<"details" | "notes">("details");

  // LIVE CONVERSATIONS counts (Unassigned / My open / Solved) — from API
  const [viewCounts, setViewCounts] = useState({ unassigned: 0, myOpen: 0, solved: 0 });

  // Plan info
  const [planKey, setPlanKey] = useState<string>("free");
  const isPro = planKey === "pro" || planKey === "business" || planKey === "PRO" || planKey === "BUSINESS";
  const isProPlus = isPro; // Pro+ features (AI assist, smart filters)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"quota" | "plan">("plan");
  const [upgradeRequiredPlan, setUpgradeRequiredPlan] = useState<string>("pro");

  // Bulk select
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);

  // AI Actions
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<"suggest" | "summarize" | "translate" | null>(null);

  // Smart filters (PRO+)
  const [smartFilter, setSmartFilter] = useState<string | null>(null);

  // Toast (now uses premium toast, keep showToast for compatibility)
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2500); }, []);

  // Typing indicator
  const {
    emitAgentTyping,
    emitAgentTypingStop,
    onUserTyping,
    onUserTypingStop,
    socketStatus,
  } = usePortalInboxNotification();
  const [userTypingConvId, setUserTypingConvId] = useState<string | null>(null);
  const agentTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync unread filter from URL (?unread=1 → okunmamış mesajlara tek tık)
  useEffect(() => {
    setUnreadOnly(searchParams.get("unread") === "1");
  }, [searchParams]);

  // Debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // Team
  const fetchTeamMembers = useCallback(async () => {
    try { const res = await portalApiFetch("/portal/team/users"); if (res.ok) { const d = await res.json(); setTeamMembers(d.users || []); } } catch { /* */ }
  }, []);
  useEffect(() => { if (!authLoading && user) fetchTeamMembers(); }, [authLoading, user, fetchTeamMembers]);

  // Fetch plan info (safe: do not throw on 404 or invalid JSON)
  useEffect(() => {
    if (authLoading || !user) return;
    portalApiFetch("/portal/billing/status")
      .then(async (res) => {
        if (!res.ok) return;
        try {
          const d = await res.json();
          setPlanKey(d.plan?.key ?? d.planKey ?? "free");
        } catch {
          // ignore invalid JSON
        }
      })
      .catch(() => {});
  }, [authLoading, user]);

  // ── AI Actions ──
  // Sentiment result state
  const [aiSentiment, setAiSentiment] = useState<{ sentiment: string; summary: string; detectedLanguage: string; topics: string[] } | null>(null);

  // Helper: handle 402 quota exceeded from any AI endpoint
  const handleAiQuotaError = useCallback(() => {
    setUpgradeReason("quota");
    setUpgradeRequiredPlan("pro");
    setShowUpgradeModal(true);
  }, []);

  const handleAiSuggest = useCallback(async () => {
    if (!selectedConversationId || aiLoading || isLoadingDetail) return;
    if (!isProPlus) { setUpgradeReason("plan"); setUpgradeRequiredPlan("pro"); setShowUpgradeModal(true); return; }
    if (!conversationDetail?.messages?.length) { premiumToast.error({ title: t("inbox.ai.noMessagesYet") }); return; }
    setAiLoading("suggest");
    setAiSuggestions(null);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/ai-suggest`, { method: "POST" });
      const d = await res.json();
      if (res.status === 402) { handleAiQuotaError(); return; }
      if (res.ok && d.ok) {
        setAiSuggestions(d.suggestions);
      } else {
        premiumToast.error({ title: d.error || t("common.error") });
      }
    } catch { premiumToast.error({ title: t("common.error") }); }
    finally { setAiLoading(null); }
  }, [selectedConversationId, aiLoading, isLoadingDetail, isProPlus, conversationDetail, handleAiQuotaError, t]);

  const handleAiSummarize = useCallback(async () => {
    if (!selectedConversationId || aiLoading || isLoadingDetail) return;
    if (!isProPlus) { setUpgradeReason("plan"); setUpgradeRequiredPlan("pro"); setShowUpgradeModal(true); return; }
    if (!conversationDetail?.messages?.length) { premiumToast.error({ title: t("inbox.ai.noMessagesYet") }); return; }
    setAiLoading("summarize");
    setAiSummary(null);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/ai-summarize`, { method: "POST" });
      const d = await res.json();
      if (res.status === 402) { handleAiQuotaError(); return; }
      if (res.ok && d.ok) {
        setAiSummary(d.summary);
      } else {
        premiumToast.error({ title: d.error || t("common.error") });
      }
    } catch { premiumToast.error({ title: t("common.error") }); }
    finally { setAiLoading(null); }
  }, [selectedConversationId, aiLoading, isLoadingDetail, isProPlus, conversationDetail, handleAiQuotaError, t]);

  // FREE: AI Sentiment Analysis
  const handleAiSentiment = useCallback(async () => {
    if (!selectedConversationId || aiLoading || isLoadingDetail) return;
    if (!conversationDetail?.messages?.length) { premiumToast.error({ title: t("inbox.ai.noMessagesYet") }); return; }
    setAiLoading("suggest"); // reuse loading state
    setAiSentiment(null);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/ai-sentiment`, { method: "POST" });
      const d = await res.json();
      if (res.status === 402) { handleAiQuotaError(); return; }
      if (res.ok && d.ok) {
        setAiSentiment({ sentiment: d.sentiment, summary: d.summary, detectedLanguage: d.detectedLanguage, topics: d.topics });
      } else {
        premiumToast.error({ title: d.error || t("common.error") });
      }
    } catch { premiumToast.error({ title: t("common.error") }); }
    finally { setAiLoading(null); }
  }, [selectedConversationId, aiLoading, isLoadingDetail, conversationDetail, handleAiQuotaError, t]);

  // FREE: AI Quick Reply (single contextual reply)
  const handleAiQuickReply = useCallback(async () => {
    if (!selectedConversationId || aiLoading || isLoadingDetail) return;
    if (!conversationDetail?.messages?.length) { premiumToast.error({ title: t("inbox.ai.noMessagesYet") }); return; }
    setAiLoading("suggest");
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/ai-quick-reply`, { method: "POST" });
      const d = await res.json();
      if (res.status === 402) { handleAiQuotaError(); return; }
      if (res.ok && d.ok) {
        setReplyBody(d.reply);
        premiumToast.success({ title: t("inbox.ai.quickReplyGenerated") });
      } else {
        premiumToast.error({ title: d.error || t("common.error") });
      }
    } catch { premiumToast.error({ title: t("common.error") }); }
    finally { setAiLoading(null); }
  }, [selectedConversationId, aiLoading, isLoadingDetail, conversationDetail, t, handleAiQuotaError]);

  // ── Bulk Actions ──
  const toggleBulkSelect = useCallback((id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Fetch LIVE CONVERSATIONS counts (Unassigned / My open / Solved)
  const fetchViewCounts = useCallback(async () => {
    try {
      const res = await portalApiFetch("/portal/conversations/counts");
      if (res.ok) {
        const d = await res.json();
        setViewCounts({ unassigned: d.unassigned ?? 0, myOpen: d.myOpen ?? 0, solved: d.solved ?? 0 });
      }
    } catch { /* */ }
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async (cursorVal?: string, append = false) => {
    try {
      if (!append) setIsLoading(true);
      setError(null);
      const p = new URLSearchParams();
      p.set("status", statusFilter);
      p.set("assigned", assignedFilter);
      if (unreadOnly) p.set("unreadOnly", "1");
      if (debouncedSearch) p.set("q", debouncedSearch);
      p.set("limit", "50");
      if (cursorVal) p.set("cursor", cursorVal);
      const res = await portalApiFetch(`/portal/conversations?${p.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (append) setConversations(prev => sortConversations([...prev, ...(data.items || [])]));
      else setConversations(sortConversations(data.items || []));
      setNextCursor(data.nextCursor || null);
      fetchViewCounts();
    } catch { setError(t("dashboard.failedLoadConversations")); }
    finally { setIsLoading(false); }
  }, [statusFilter, assignedFilter, unreadOnly, debouncedSearch, t, fetchViewCounts]);

  const handleBulkAction = useCallback(async (action: "CLOSE" | "OPEN" | "ASSIGN" | "UNASSIGN") => {
    if (bulkSelected.size === 0 || isBulkActing) return;
    setIsBulkActing(true);
    try {
      const res = await portalApiFetch("/portal/conversations/bulk", {
        method: "POST",
        body: JSON.stringify({ conversationIds: Array.from(bulkSelected), action }),
      });
      if (res.ok) {
        premiumToast.success({ title: t("inbox.bulk.actionComplete"), description: `${bulkSelected.size} conversations updated` });
        setBulkSelected(new Set());
        setBulkMode(false);
        fetchConversations();
      }
    } catch { premiumToast.error({ title: "Bulk action failed" }); }
    finally { setIsBulkActing(false); }
  }, [bulkSelected, isBulkActing, t, fetchConversations]);

  useEffect(() => { if (!authLoading) fetchConversations(); }, [authLoading, fetchConversations]);

  // Poll for new conversations (e.g. from widget) so inbox updates without manual refresh
  useEffect(() => {
    if (authLoading || !user) return;
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [authLoading, user, fetchConversations]);

  useEffect(() => {
    if (!authLoading && user) fetchViewCounts();
  }, [authLoading, user, fetchViewCounts]);

  // Detail + notes
  const fetchConversationDetail = useCallback(async (id: string) => {
    try { setIsLoadingDetail(true); const res = await portalApiFetch(`/portal/conversations/${id}`); if (!res.ok) throw new Error(); setConversationDetail(await res.json()); }
    finally { setIsLoadingDetail(false); }
  }, []);
  const fetchNotes = useCallback(async (id: string) => {
    try { const res = await portalApiFetch(`/portal/conversations/${id}/notes`); if (res.ok) { const d = await res.json(); setNotes(d.notes || []); } } catch { /* */ }
  }, []);

  const refreshUnreadBadge = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
    } catch { /* */ }
  }, []);

  const markConversationAsRead = useCallback(async (conversationId: string) => {
    try {
      const res = await portalApiFetch(`/portal/conversations/${conversationId}/read`, { method: "POST" });
      if (res.ok) return true;
    } catch { /* */ }
    return false;
  }, []);

  const markAllConversationsAsRead = useCallback(async () => {
    try {
      const res = await portalApiFetch("/portal/conversations/read-all", { method: "POST" });
      if (res.ok) {
        setConversations(prev => sortConversations(prev.map(c => ({ ...c, hasUnreadMessages: false }))));
        refreshUnreadBadge();
        [0, 200, 600].forEach((ms) => setTimeout(refreshUnreadBadge, ms));
        await fetchConversations();
        refreshUnreadBadge();
        showToast(t("inbox.markAllRead"));
      }
    } catch { /* */ }
  }, [refreshUnreadBadge, fetchConversations, showToast, t]);

  const selectConversation = useCallback((id: string) => {
    // Immediate UI update — no await, respond to click instantly
    setSelectedConversationId(id);
    setConversations(prev => sortConversations(prev.map(c => c.id === id ? { ...c, hasUnreadMessages: false } : c)));
    setMobileView("chat");
    setIsLoadingDetail(true);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("c", id);
      router.replace(`/portal/inbox?${params.toString()}`, { scroll: false });
    }

    // Fire all API calls in parallel — don't block UI
    fetchConversationDetail(id);
    fetchNotes(id);
    markConversationAsRead(id).then(() => {
      refreshUnreadBadge();
      fetchConversations();
      [200, 600, 1200].forEach((ms) => setTimeout(refreshUnreadBadge, ms));
    });
  }, [router, fetchConversationDetail, fetchNotes, fetchConversations, refreshUnreadBadge, markConversationAsRead]);

  const closePanel = useCallback(() => {
    setSelectedConversationId(null); setConversationDetail(null); setNotes([]); setMobileView("list");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("c");
      router.replace(params.toString() ? `/portal/inbox?${params.toString()}` : "/portal/inbox", { scroll: false });
    }
    refreshUnreadBadge();
    [200, 600, 1000].forEach((ms) => setTimeout(refreshUnreadBadge, ms));
  }, [router, refreshUnreadBadge]);

  const copyLink = useCallback(() => {
    if (!selectedConversationId) return;
    const url = `${window.location.origin}/portal/inbox?c=${selectedConversationId}`;
    navigator.clipboard.writeText(url).then(() => showToast(t("inbox.detail.linkCopied")));
  }, [selectedConversationId, showToast, t]);

  // Badge: Inbox sayfası açıldığında unread count’u hemen güncelle (bell tıklayınca doğru sayı)
  useEffect(() => {
    refreshUnreadBadge();
  }, [refreshUnreadBadge]);

  // Auto-select from URL
  useEffect(() => {
    if (typeof window === "undefined" || authLoading || conversations.length === 0) return;
    const c = searchParams.get("c");
    if (c && !selectedConversationId && conversations.find(cv => cv.id === c)) selectConversation(c);
  }, [authLoading, conversations, searchParams, selectedConversationId, selectConversation]);

  // Fallback polling when Socket.IO is not connected
  useEffect(() => {
    if (socketStatus.startsWith("connected")) return;
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedConversationId) {
        fetchConversationDetail(selectedConversationId);
      }
      try {
        window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
      } catch { /* */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [socketStatus, selectedConversationId, fetchConversations, fetchConversationDetail]);

  // If a new message arrives:
  // - active convo: mark read immediately
  // - other convo: mark unread so badge shows
  useEffect(() => {
    const onMessageNew = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string; content?: string }>).detail;
      const conversationId = detail?.conversationId;
      if (!conversationId) return;

      const nowIso = new Date().toISOString();
      const previewText = (detail?.content || "").slice(0, 80);

      if (conversationId === selectedConversationId) {
        setConversations(prev => sortConversations(prev.map(c => c.id === conversationId
          ? { ...c, hasUnreadMessages: false, messageCount: c.messageCount + 1, updatedAt: nowIso, preview: c.preview ? { ...c.preview, text: previewText } : { text: previewText, from: "user" } }
          : c
        )));
        fetchConversationDetail(conversationId).then(() => {
          try {
            window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
          } catch { /* */ }
        });
        return;
      }

      setConversations(prev => sortConversations(prev.map(c => c.id === conversationId
        ? { ...c, hasUnreadMessages: true, messageCount: c.messageCount + 1, updatedAt: nowIso, preview: c.preview ? { ...c.preview, text: previewText } : { text: previewText, from: "user" } }
        : c
      )));
      fetchConversations();
    };
    window.addEventListener("portal-inbox-message-new", onMessageNew as EventListener);
    return () => window.removeEventListener("portal-inbox-message-new", onMessageNew as EventListener);
  }, [selectedConversationId, fetchConversationDetail, fetchConversations]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversationDetail?.messages]);

  // Listen for user typing events
  useEffect(() => {
    const offTyping = onUserTyping((data) => {
      setUserTypingConvId(data.conversationId);
      if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
      userTypingTimerRef.current = setTimeout(() => setUserTypingConvId(null), 3000);
    });
    const offStop = onUserTypingStop(() => {
      setUserTypingConvId(null);
      if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
    });
    return () => { offTyping(); offStop(); };
  }, [onUserTyping, onUserTypingStop]);

  // Actions
  const handleStatusChange = async (s: "OPEN" | "CLOSED") => {
    if (!selectedConversationId || !conversationDetail) return;
    setIsUpdating(true);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}`, { method: "PATCH", body: JSON.stringify({ status: s }) });
      if (res.ok) {
        const d = await res.json();
        setConversationDetail({ ...conversationDetail, status: d.conversation.status, closedAt: d.conversation.closedAt });
        setConversations(prev => prev.map(c => c.id === selectedConversationId ? { ...c, status: d.conversation.status, closedAt: d.conversation.closedAt } : c));
        showToast(t("inbox.statusUpdated"));
      }
    } catch { /* */ } finally { setIsUpdating(false); }
  };

  const handleAssignmentChange = async (userId: string | null) => {
    if (!selectedConversationId || !conversationDetail) return;
    setIsUpdating(true);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}`, { method: "PATCH", body: JSON.stringify({ assignedToUserId: userId }) });
      if (res.ok) {
        const d = await res.json();
        setConversationDetail({ ...conversationDetail, assignedTo: d.conversation.assignedTo });
        setConversations(prev => prev.map(c => c.id === selectedConversationId ? { ...c, assignedTo: d.conversation.assignedTo, assignedToOrgUserId: d.conversation.assignedTo?.id || null } : c));
        showToast(t("inbox.assigneeUpdated"));
      }
    } catch { /* */ } finally { setIsUpdating(false); }
  };

  const handleAddNote = async () => {
    if (!selectedConversationId || !noteBody.trim()) return;
    setIsSubmittingNote(true);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/notes`, { method: "POST", body: JSON.stringify({ body: noteBody.trim() }) });
      if (res.ok) {
        const d = await res.json();
        setNotes(prev => [d.note, ...prev]);
        setNoteBody("");
        setConversations(prev => prev.map(c => c.id === selectedConversationId ? { ...c, noteCount: c.noteCount + 1 } : c));
        showToast(t("inbox.noteSubmit"));
      }
    } catch { /* */ } finally { setIsSubmittingNote(false); }
  };

  const handleSendReply = async () => {
    if (!selectedConversationId || !conversationDetail || !replyBody.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: replyBody.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        const newMsg = {
          id: d.id,
          conversationId: selectedConversationId,
          role: "assistant" as const,
          content: d.content,
          timestamp: d.timestamp,
        };
        setConversationDetail({
          ...conversationDetail,
          messages: [...conversationDetail.messages, newMsg],
        });
        setReplyBody("");
        showToast(t("inbox.chat.replySent"));
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = typeof err?.error === "object" && err?.error?.message
          ? err.error.message
          : typeof err?.error === "string"
            ? err.error
            : t("common.error");
        showToast(msg);
      }
    } catch {
      showToast(t("common.error"));
    } finally {
      setIsSendingReply(false);
    }
  };

  // Derived
  const selectedConv = conversations.find(c => c.id === selectedConversationId);
  const currentStatus = conversationDetail?.status || "OPEN";
  const isOpen = currentStatus === "OPEN";

  // Current view label for list header (Tidio: "My open" above list)
  const currentViewLabel =
    statusFilter === "CLOSED"
      ? t("inbox.filterSolved")
      : assignedFilter === "me"
        ? t("inbox.filterMyOpen")
        : t("inbox.filterUnassigned");

  // Empty list hint per view (Tidio: "You have no conversations assigned to you at the moment.")
  const emptyListHint =
    statusFilter === "CLOSED"
      ? t("inbox.empty.solvedHint")
      : assignedFilter === "me"
        ? t("inbox.empty.myOpenHint")
        : t("inbox.empty.unassignedHint");

  if (authLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#1A1A2E] animate-spin" /></div>;
  }

  const _totalOpen = viewCounts.unassigned + viewCounts.myOpen;
  void _totalOpen;

  return (
    <div className="portal-inbox-root fixed inset-0 top-16 lg:left-[260px] flex overflow-hidden bg-[#f8f9fb] z-10">

      {/* ═══ PANEL 1: LEFT SIDEBAR ═══ */}
      <div className={`w-full sm:w-[320px] lg:w-[340px] flex-shrink-0 border-r border-slate-200/80 flex flex-col bg-white ${mobileView !== "list" ? "hidden sm:flex" : "flex"}`}>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="relative group">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t("inbox.sidebar.search")}
              className="w-full pl-10 pr-4 py-2.5 font-[var(--font-body)] text-[13px] border border-amber-200/70 rounded-xl bg-[#FFFBF5] placeholder:text-slate-400 focus:outline-none focus:border-[#FDB462] focus:ring-4 focus:ring-amber-100 focus:bg-white transition-all shadow-sm" />
          </div>
        </div>

        {/* Okunmamış filtre aktif — zilden tek tıkla buraya gelindiğinde görünür */}
        {unreadOnly && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100">
              <span className="text-[12px] font-semibold text-blue-800">{t("inbox.filterUnreadOnly")}</span>
              <Link
                href="/portal/inbox"
                onClick={() => setUnreadOnly(false)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                {t("inbox.showAllConversations")}
              </Link>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex rounded-xl bg-amber-50/70 p-1 gap-0.5 border border-amber-100/70">
            <button onClick={() => { setStatusFilter("OPEN"); setAssignedFilter("unassigned"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-[var(--font-body)] text-[12px] font-semibold transition-all duration-200 ${
                statusFilter === "OPEN" && assignedFilter === "unassigned" ? "bg-white text-amber-800 shadow-sm ring-1 ring-amber-200" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}>
              {t("inbox.filterUnassigned")}
              {viewCounts.unassigned > 0 && (
                <span className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                  statusFilter === "OPEN" && assignedFilter === "unassigned" ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30" : "bg-slate-200/80 text-slate-600"
                }`}>{viewCounts.unassigned > 99 ? "99+" : viewCounts.unassigned}</span>
              )}
            </button>
            <button onClick={() => { setStatusFilter("OPEN"); setAssignedFilter("me"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-[var(--font-body)] text-[12px] font-semibold transition-all duration-200 ${
                statusFilter === "OPEN" && assignedFilter === "me" ? "bg-white text-sky-700 shadow-sm ring-1 ring-sky-200" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}>
              {t("inbox.filterMyOpen")}
              {viewCounts.myOpen > 0 && (
                <span className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                  statusFilter === "OPEN" && assignedFilter === "me" ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30" : "bg-slate-200/80 text-slate-600"
                }`}>{viewCounts.myOpen}</span>
              )}
            </button>
            <button onClick={() => { setStatusFilter("CLOSED"); setAssignedFilter("any"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-[var(--font-body)] text-[12px] font-semibold transition-all duration-200 ${
                statusFilter === "CLOSED" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}>
              {t("inbox.filterSolved")}
              {viewCounts.solved > 0 && (
                <span className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                  statusFilter === "CLOSED" ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30" : "bg-slate-200/80 text-slate-600"
                }`}>{viewCounts.solved}</span>
              )}
            </button>
          </div>
        </div>

        {/* Smart Filters (PRO+ with lock) */}
        <div className="px-4 pb-2.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: "needsReply", icon: AlertCircle, color: "text-amber-600 bg-amber-50 border-amber-200", proOnly: false },
              { key: "urgent", icon: AlertCircle, color: "text-red-600 bg-red-50 border-red-200", proOnly: false },
              { key: "vip", icon: Star, color: "text-purple-600 bg-purple-50 border-purple-200", proOnly: true },
              { key: "autoCategorized", icon: Tag, color: "text-blue-600 bg-blue-50 border-blue-200", proOnly: true },
            ].map((f) => {
              const locked = f.proOnly && !isPro;
              const active = smartFilter === f.key;
              const Icon = f.icon;
              const tooltipKey = locked
                ? `inbox.smartFilter.${f.key}LockedTooltip`
                : `inbox.smartFilter.${f.key}Tooltip`;
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    if (locked) { setUpgradeReason("plan"); setUpgradeRequiredPlan("pro"); setShowUpgradeModal(true); return; }
                    setSmartFilter(active ? null : f.key);
                  }}
                  title={t(tooltipKey as TranslationKey)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold border rounded-lg transition-all ${
                    active
                      ? f.color + " ring-1 ring-current/20"
                      : locked
                        ? "text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed"
                        : "text-slate-500 bg-white border-slate-200 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  <Icon size={11} />
                  {t(`inbox.smartFilter.${f.key}` as TranslationKey)}
                  {locked && <Lock size={9} className="text-slate-300" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* List header */}
        <div className="px-4 py-2 border-t border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{currentViewLabel}</span>
          <div className="flex items-center gap-1.5">
            {/* Bulk select toggle */}
            {isPro ? (
              <button
                onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}
                className={`p-1 rounded transition-colors ${bulkMode ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-slate-600"}`}
                title={t("inbox.bulk.selectMode")}
              >
                <CheckSquare size={14} />
              </button>
            ) : (
              <button
                onClick={() => { setUpgradeReason("plan"); setUpgradeRequiredPlan("pro"); setShowUpgradeModal(true); }}
                className="p-1 text-slate-300 hover:text-slate-400 rounded transition-colors"
                title={t("inbox.ai.proFeature")}
              >
                <CheckSquare size={14} />
              </button>
            )}
            {conversations.length > 0 && (
              <button onClick={() => markAllConversationsAsRead()}
                className="p-1.5 text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                title={t("inbox.markAllRead")}>
                {t("inbox.markAllRead")}
              </button>
            )}
            <button onClick={() => fetchConversations()} disabled={isLoading}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors disabled:opacity-50" title={t("common.refresh")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" /></svg>
            </button>
          </div>
        </div>

        {/* Bulk action bar */}
        {bulkMode && bulkSelected.size > 0 && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2 flex-shrink-0 animate-in slide-in-from-top-2">
            <span className="text-[11px] font-bold text-blue-700">{t("inbox.bulk.selected").replace("{count}", String(bulkSelected.size))}</span>
            <div className="flex-1" />
            <button onClick={() => handleBulkAction("CLOSE")} disabled={isBulkActing}
              className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {t("inbox.bulk.closeAll")}
            </button>
            <button onClick={() => handleBulkAction("OPEN")} disabled={isBulkActing}
              className="px-2.5 py-1 text-[10px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {t("inbox.bulk.openAll")}
            </button>
            <button onClick={() => handleBulkAction("UNASSIGN")} disabled={isBulkActing}
              className="px-2.5 py-1 text-[10px] font-semibold bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
              {t("inbox.bulk.unassign")}
            </button>
            <button onClick={() => { setBulkMode(false); setBulkSelected(new Set()); }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {error && <div className="m-3"><ErrorBanner message={error} /></div>}
          {isLoading && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
                <span className="text-[11px] text-slate-400 font-medium">{t("common.loading")}</span>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto mb-4 text-4xl leading-none">💬</div>
              <p className="text-sm font-bold text-slate-700 mb-1">{emptyListHint}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{t("inbox.empty.desc")}</p>
            </div>
          ) : conversations.map(conv => {
            const name = displayName(conv, t);
            const active = conv.id === selectedConversationId;
            const hasUnread = !!conv.hasUnreadMessages;
            return (
              <div key={conv.id} onClick={() => selectConversation(conv.id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectConversation(conv.id); } }}
                className={`group relative mx-2 my-1 px-3 py-3 cursor-pointer rounded-xl transition-all duration-200 ${
                  active
                    ? "bg-blue-50/80 ring-1 ring-blue-200/60 shadow-sm"
                    : hasUnread
                      ? "bg-white hover:bg-emerald-50/40 animate-pulse-green"
                      : "hover:bg-slate-50/60"
                }`}>
                {/* Active indicator bar */}
                {active && <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-blue-500 rounded-r-full" />}

                <div className="flex items-start gap-3">
                  {/* Bulk checkbox */}
                  {bulkMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleBulkSelect(conv.id); }}
                      className="flex-shrink-0 mt-2 text-slate-400 hover:text-blue-500 transition-colors"
                    >
                      {bulkSelected.has(conv.id) ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
                    </button>
                  )}
                  {/* Avatar */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shadow-sm ${getAvatarColor(conv.id)}`}>
                      {getInitials(name)}
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm shadow-emerald-500/40 bell-dot" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-[13px] truncate ${hasUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>{name}</span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums font-medium" suppressHydrationWarning>{hydrated ? formatRelativeTime(conv.updatedAt, t) : formatTime(conv.updatedAt, hydrated)}</span>
                    </div>
                    {conv.preview && <p className={`text-[12px] leading-snug truncate mb-1.5 ${hasUnread ? "text-slate-700 font-medium" : "text-slate-500"}`}>{conv.preview.text}</p>}
                    <div className="flex items-center gap-1.5">
                      {conv.slaStatus && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                            conv.slaStatus === "breached"
                              ? "text-red-700 bg-red-50"
                              : conv.slaStatus === "warning"
                              ? "text-amber-700 bg-amber-50"
                              : "text-emerald-700 bg-emerald-50"
                          }`}
                        >
                          {conv.slaStatus === "breached"
                            ? t("usage.critical")
                            : conv.slaStatus === "warning"
                            ? t("usage.warning")
                            : t("usage.healthy")}
                        </span>
                      )}
                      {conv.assignedTo && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded-md font-medium">
                          <User size={9} className="text-slate-400" />{conv.assignedTo.email.split("@")[0]}
                        </span>
                      )}
                      {conv.status === "CLOSED" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle size={9} />{t("inbox.statusClosed")}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-300 tabular-nums font-medium">{conv.messageCount} {t("common.abbrev.messages")}</span>
                    </div>
                  </div>

                  {/* Unread badge */}
                  {hasUnread && conv.messageCount > 0 && (
                    <span className="mt-1 min-w-[22px] h-[22px] px-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/30 bell-dot">
                      {conv.messageCount > 99 ? "99+" : conv.messageCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {nextCursor && (
            <div className="px-4 py-3 text-center">
              <button onClick={() => fetchConversations(nextCursor, true)} disabled={isLoading}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold">{t("inbox.loadMore")}</button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ PANEL 2: CENTER — Chat or Rich Empty State ═══ */}
      <div className={`flex-1 flex flex-col min-w-0 ${mobileView !== "chat" && mobileView !== "list" ? "hidden sm:flex" : mobileView === "list" ? "hidden sm:flex" : "flex"}`}>
        {!selectedConversationId ? (
          /* ── Design 1: Bold stats + clean list card ── */
          <div className="flex-1 overflow-y-auto bg-[#f8f9fb] px-6 py-6">
            <div className="mb-5">
              <h1 className="font-[var(--font-heading)] text-[32px] font-extrabold leading-tight text-[#1A1D23]">
                {t("inbox.design1.pageTitle")}
              </h1>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {[
                {
                  emoji: "📥",
                  label: t("inbox.design1.stats.unassigned"),
                  value: viewCounts.unassigned,
                  gradient: "linear-gradient(135deg, #FDB462, #F59E0B)",
                },
                {
                  emoji: "👤",
                  label: t("inbox.design1.stats.myOpen"),
                  value: viewCounts.myOpen,
                  gradient: "linear-gradient(135deg, #93C5FD, #60A5FA)",
                },
                {
                  emoji: "✅",
                  label: t("inbox.design1.stats.solved"),
                  value: viewCounts.solved,
                  gradient: "linear-gradient(135deg, #6EE7B7, #10B981)",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="relative overflow-hidden rounded-2xl border border-white/20 px-5 py-4 shadow-[0_12px_32px_rgba(26,29,35,0.14)]"
                  style={{ background: item.gradient }}
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/20" />
                  <div className="relative">
                    <div className="text-[30px] leading-none">{item.emoji}</div>
                    <p className="mt-3 font-[var(--font-heading)] text-[32px] font-bold leading-none text-white tabular-nums">
                      {item.value}
                    </p>
                    <p className="mt-2 font-[var(--font-body)] text-[13px] font-medium text-white/90">
                      {item.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex min-h-[420px] items-center justify-center rounded-[16px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="max-w-md text-center">
                <div className="mb-4 text-6xl leading-none">💬</div>
                <h2 className="font-[var(--font-heading)] text-[20px] font-bold text-[#1A1D23]">
                  {t("inbox.design1.empty.heading")}
                </h2>
                <p className="mt-2 font-[var(--font-body)] text-[14px] font-normal text-slate-500">
                  {t("inbox.design1.empty.description")}
                </p>
                <Link
                  href="/demo-chat"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-[var(--font-body)] text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(245,158,11,0.28)] transition-all duration-200 hover:brightness-95"
                  style={{ background: "linear-gradient(135deg, #FDB462, #F59E0B)" }}
                >
                  <MessageSquare size={14} />
                  {t("inbox.simulateConversation")}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Chat header ── */}
            <div className="px-5 py-3 bg-white border-b border-slate-200/60 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3.5">
                <button onClick={closePanel} className="sm:hidden text-slate-500 hover:text-slate-700"><ArrowLeft size={18} /></button>
                <div className="relative">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm ${getAvatarColor(selectedConversationId)}`}>
                    {selectedConv ? getInitials(displayName(selectedConv, t)) : "?"}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isOpen ? "bg-emerald-400 shadow-sm shadow-emerald-400/40" : "bg-slate-300"}`} />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-900">{selectedConv ? displayName(selectedConv, t) : ""}</div>
                  {userTypingConvId === selectedConversationId ? (
                    <div className="flex items-center gap-1 text-[11px] text-blue-500 font-medium">
                      <span className="inline-flex gap-0.5">
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      {t("inbox.typing.userTyping")}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      {isOpen ? t("inbox.sidebar.online") : t("inbox.sidebar.offline")}
                      {conversationDetail?.messages?.length ? ` \u00B7 ${conversationDetail.messages.length} messages` : ""}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* FREE AI: Quick Reply */}
                <button
                  onClick={handleAiQuickReply}
                  disabled={!!aiLoading || isLoadingDetail}
                  title={t("inbox.ai.quickReplyTooltip")}
                  className="relative p-2 rounded-lg transition-all text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {aiLoading ? <span className="w-4 h-4 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin block" /> : <Sparkles size={15} />}
                </button>
                {/* FREE AI: Sentiment */}
                <button
                  onClick={handleAiSentiment}
                  disabled={!!aiLoading || isLoadingDetail}
                  title={t("inbox.ai.sentimentTooltip")}
                  className="relative p-2 rounded-lg transition-all text-violet-500 hover:text-violet-700 hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Smile size={15} />
                </button>

                <div className="w-px h-5 bg-slate-200 mx-0.5" />

                {/* PRO AI: Suggest 3 Replies */}
                <button
                  onClick={handleAiSuggest}
                  disabled={!!aiLoading || isLoadingDetail}
                  title={isProPlus ? t("inbox.ai.suggestReplyTooltip") : t("inbox.ai.suggestReplyLockedTooltip")}
                  className={`relative p-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isProPlus
                      ? "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      : "text-slate-300 hover:text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {aiLoading === "suggest" ? <span className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin block" /> : <Wand2 size={15} />}
                  {!isProPlus && <Lock size={7} className="absolute -top-0.5 -right-0.5 text-slate-400" />}
                </button>
                {/* PRO AI: Summarize */}
                <button
                  onClick={handleAiSummarize}
                  disabled={!!aiLoading || isLoadingDetail}
                  title={isProPlus ? t("inbox.ai.summarizeTooltip") : t("inbox.ai.summarizeLockedTooltip")}
                  className={`relative p-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isProPlus
                      ? "text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                      : "text-slate-300 hover:text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {aiLoading === "summarize" ? <span className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin block" /> : <FileText size={15} />}
                  {!isProPlus && <Lock size={7} className="absolute -top-0.5 -right-0.5 text-slate-400" />}
                </button>

                <div className="w-px h-5 bg-slate-200 mx-0.5" />

                <button onClick={copyLink} title={t("inbox.detail.copyLink")}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><Copy size={15} /></button>
                {isOpen ? (
                  <button onClick={() => handleStatusChange("CLOSED")} disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                    <CheckCircle size={13} />{t("inbox.chat.close")}
                  </button>
                ) : (
                  <button onClick={() => handleStatusChange("OPEN")} disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors">
                    {t("inbox.reopenConversation")}
                  </button>
                )}
                <select value={conversationDetail?.assignedTo?.id || ""} onChange={e => handleAssignmentChange(e.target.value || null)}
                  disabled={isUpdating} className="hidden lg:block px-2.5 py-1.5 text-[12px] font-medium border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:border-blue-400 disabled:opacity-50">
                  <option value="">{t("inbox.chat.assign")}</option>
                  {teamMembers.filter(m => m.isActive).map(m => <option key={m.id} value={m.id}>{m.email.split("@")[0]}</option>)}
                </select>
                <button onClick={() => setShowRightPanel(!showRightPanel)} title={showRightPanel ? t("inbox.detail.closePanel") : t("inbox.detail.details")}
                  className="hidden lg:flex p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  {showRightPanel ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                </button>
                <button onClick={() => setMobileView("details")} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><User size={15} /></button>
              </div>
            </div>

            {/* ── AI Sentiment Panel (FREE) ── */}
            {aiSentiment && (
              <div className="mx-5 mt-3 p-4 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200/60 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      aiSentiment.sentiment === "positive" ? "bg-gradient-to-br from-emerald-500 to-green-500"
                      : aiSentiment.sentiment === "negative" || aiSentiment.sentiment === "frustrated" ? "bg-gradient-to-br from-red-500 to-rose-500"
                      : "bg-gradient-to-br from-violet-500 to-indigo-500"
                    }`}>
                      <Smile size={12} className="text-white" />
                    </div>
                    <span className="text-[12px] font-bold text-violet-800">{t("inbox.ai.sentimentTitle")}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      aiSentiment.sentiment === "positive" ? "bg-emerald-100 text-emerald-700"
                      : aiSentiment.sentiment === "negative" || aiSentiment.sentiment === "frustrated" ? "bg-red-100 text-red-700"
                      : "bg-violet-100 text-violet-700"
                    }`}>{aiSentiment.sentiment}</span>
                    {aiSentiment.detectedLanguage && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 uppercase">{aiSentiment.detectedLanguage}</span>
                    )}
                  </div>
                  <button onClick={() => setAiSentiment(null)} className="p-1 text-violet-400 hover:text-violet-600 rounded transition-colors"><X size={14} /></button>
                </div>
                <p className="text-[12px] text-slate-600 leading-relaxed">{aiSentiment.summary}</p>
                {aiSentiment.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {aiSentiment.topics.map((topic, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white border border-violet-100 text-violet-700">{topic}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── AI Summary Panel ── */}
            {aiSummary && (
              <div className="mx-5 mt-3 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-200/60 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
                      <FileText size={12} className="text-white" />
                    </div>
                    <span className="text-[12px] font-bold text-purple-800">{t("inbox.ai.summaryTitle")}</span>
                  </div>
                  <button onClick={() => setAiSummary(null)} className="p-1 text-purple-400 hover:text-purple-600 rounded transition-colors"><X size={14} /></button>
                </div>
                <p className="text-[13px] text-slate-700 leading-relaxed">{aiSummary}</p>
              </div>
            )}

            {/* ── AI Suggestions Panel ── */}
            {aiSuggestions && (
              <div className="mx-5 mt-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Wand2 size={12} className="text-white" />
                    </div>
                    <span className="text-[12px] font-bold text-blue-800">{t("inbox.ai.suggestionsTitle")}</span>
                  </div>
                  <button onClick={() => setAiSuggestions(null)} className="p-1 text-blue-400 hover:text-blue-600 rounded transition-colors"><X size={14} /></button>
                </div>
                <div className="space-y-2">
                  {aiSuggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => { setReplyBody(suggestion); setAiSuggestions(null); premiumToast.info({ title: t("inbox.ai.useSuggestion") }); }}
                      className="w-full text-left p-3 rounded-xl bg-white/80 border border-blue-100 hover:border-blue-300 hover:bg-white hover:shadow-sm transition-all group"
                    >
                      <p className="text-[12px] text-slate-700 leading-relaxed">{suggestion}</p>
                      <span className="text-[10px] text-blue-600 font-semibold mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Send size={9} /> {t("inbox.ai.useSuggestion")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── AI Loading indicator ── */}
            {aiLoading && (
              <div className="mx-5 mt-3 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200/60 flex items-center gap-3 animate-in fade-in">
                <div className="w-6 h-6 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
                <span className="text-[12px] font-semibold text-indigo-700">{t("inbox.ai.generating")}</span>
              </div>
            )}

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 bg-[#f8f9fb]">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-12"><div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" /></div>
              ) : conversationDetail?.messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2"><MessageSquare size={16} className="text-slate-400" /></div>
                  <p className="text-sm text-slate-400">{t("inbox.chat.noMessages")}</p>
                </div>
              ) : conversationDetail?.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"} group/msg`}>
                  {msg.role === "user" && (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mr-2.5 mt-1 shadow-sm ${getAvatarColor(selectedConversationId || "")}`}>
                      {selectedConv ? getInitials(displayName(selectedConv, t)) : "?"}
                    </div>
                  )}
                  <div className={`max-w-[65%] ${
                    msg.role === "user"
                      ? "bg-white border border-slate-200/60 text-slate-800 rounded-2xl rounded-tl-md shadow-sm hover:shadow-md px-4 py-3 transition-shadow"
                      : "bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-500 text-white rounded-2xl rounded-tr-md shadow-md shadow-blue-500/15 px-4 py-3"
                  }`}>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-white/10">
                        <div className="w-4 h-4 rounded bg-white/15 flex items-center justify-center">
                          <Bot size={10} className="text-white/80" />
                        </div>
                        <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">AI Assistant</span>
                        <Sparkles size={9} className="text-blue-300/50" />
                      </div>
                    )}
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <div className={`text-[10px] mt-1.5 text-right font-medium ${msg.role === "user" ? "text-slate-400" : "text-white/50"}`} suppressHydrationWarning>
                      {formatTime(msg.timestamp, hydrated)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Quick Replies ── */}
            <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 flex-wrap flex-shrink-0">
              {[
                { key: "inbox.quickReply.thanks", text: t("inbox.quickReply.thanks") },
                { key: "inbox.quickReply.followUp", text: t("inbox.quickReply.followUp") },
                { key: "inbox.quickReply.anythingElse", text: t("inbox.quickReply.anythingElse") },
              ].map((qr) => (
                <button key={qr.key} type="button" onClick={() => setReplyBody(qr.text)}
                  className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 rounded-lg text-slate-500 bg-white hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700 transition-colors">
                  {qr.text}
                </button>
              ))}
            </div>

            {/* ── Composer ── */}
            <div className="px-5 py-3.5 bg-white border-t border-slate-200/60 flex-shrink-0" role="form" aria-label={t("inbox.chat.replyForm")}>
              <div className="flex items-end gap-2.5">
                <div className="flex-1 relative">
                  <textarea
                    value={replyBody}
                    onChange={e => {
                      setReplyBody(e.target.value);
                      if (selectedConversationId) {
                        emitAgentTyping(selectedConversationId);
                        if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current);
                        agentTypingTimerRef.current = setTimeout(() => {
                          if (selectedConversationId) emitAgentTypingStop(selectedConversationId);
                        }, 1500);
                      }
                    }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                    placeholder={t("inbox.chat.typeMessage")}
                    disabled={isSendingReply}
                    aria-label={t("inbox.chat.typeMessage")}
                    rows={1}
                    className="w-full px-4 py-3 text-[13px] border border-slate-200/80 rounded-xl bg-slate-50/40 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 focus:bg-white disabled:opacity-50 resize-none transition-all shadow-sm"
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                  />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                  <button disabled title={t("inbox.chat.notSupported")} className="p-2.5 text-slate-300 cursor-not-allowed hover:text-slate-400 rounded-lg transition-colors"><Paperclip size={16} /></button>
                  <button disabled title={t("inbox.chat.notSupported")} className="p-2.5 text-slate-300 cursor-not-allowed hover:text-slate-400 rounded-lg transition-colors"><Smile size={16} /></button>
                  <button type="button" onClick={handleSendReply} disabled={!replyBody.trim() || isSendingReply} aria-label={t("inbox.chat.send")}
                    className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/25 transition-all">
                    {isSendingReply ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ PANEL 3: RIGHT — Customer Details + Notes ═══ */}
      <div className={`w-[320px] flex-shrink-0 bg-white border-l border-slate-200/80 flex flex-col overflow-y-auto ${
        mobileView === "details"
          ? "flex fixed inset-0 z-50 w-full bg-white lg:static lg:w-[320px]"
          : showRightPanel ? "hidden lg:flex" : "hidden"
      }`}>
        {!selectedConversationId || !conversationDetail ? (
          /* ── Empty right panel — helpful tips ── */
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-5 ring-1 ring-slate-200/60">
              <User size={24} className="text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-600 mb-1.5">{t("inbox.detail.noSelection")}</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">{t("inbox.detail.selectHint")}</p>
          </div>
        ) : (
          <>
            {/* Mobile back */}
            <div className="lg:hidden px-4 py-2.5 border-b border-slate-100">
              <button onClick={() => setMobileView("chat")} className="flex items-center gap-1.5 text-[13px] text-slate-600 font-medium">
                <ArrowLeft size={15} /> {t("inbox.mobileBack")}
              </button>
            </div>

            {/* Customer profile card */}
            <div className="px-5 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3.5 mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm ${getAvatarColor(selectedConversationId)}`}>
                  {selectedConv ? getInitials(displayName(selectedConv, t)) : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-slate-900">{selectedConv ? displayName(selectedConv, t) : ""}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                      isOpen ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {isOpen ? t("inbox.detail.open") : t("inbox.detail.close")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick stats for this conversation */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-50/80 rounded-xl px-3 py-2.5 text-center ring-1 ring-slate-100">
                  <div className="text-lg font-extrabold text-slate-900 tabular-nums">{conversationDetail.messages.length}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">{t("inbox.customer.messageCount")}</div>
                </div>
                <div className="bg-slate-50/80 rounded-xl px-3 py-2.5 text-center ring-1 ring-slate-100">
                  <div className="text-lg font-extrabold text-slate-900 tabular-nums">{notes.length}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">{t("inbox.detail.notes")}</div>
                </div>
                <div className="bg-slate-50/80 rounded-xl px-3 py-2.5 text-center ring-1 ring-slate-100">
                  <div className="text-sm font-extrabold text-slate-900 tabular-nums" suppressHydrationWarning>{hydrated ? formatRelativeTime(conversationDetail.createdAt, t) : "--"}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">{t("inbox.customer.createdAt")}</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              <button onClick={() => setDetailTab("details")}
                className={`flex-1 py-2.5 text-[12px] font-semibold text-center transition-colors ${detailTab === "details" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
                {t("inbox.detail.details")}
              </button>
              <button onClick={() => setDetailTab("notes")}
                className={`flex-1 py-2.5 text-[12px] font-semibold text-center transition-colors relative ${detailTab === "notes" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
                {t("inbox.detail.notes")}
                {notes.length > 0 && <span className="ml-1 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{notes.length}</span>}
              </button>
            </div>

            {/* Detail attributes */}
            {detailTab === "details" && (
              <div className="px-5 py-4 space-y-0 flex-1">
                <DetailRow label={t("inbox.customer.channel")} value="Web Widget" icon={<svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>} />
                <DetailRow label={t("inbox.customer.id")} value={selectedConversationId.substring(0, 16)} icon={<svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a48.667 48.667 0 00-1.234 8.244M12 20.25A7.5 7.5 0 014.5 10.5c0-1.08.228-2.108.64-3.037M12 20.25a7.5 7.5 0 007.5-9.75" /></svg>} />
                <DetailRow label={t("inbox.customer.createdAt")} value={hydrated ? formatDateTime(conversationDetail.createdAt, hydrated) : "--"} icon={<svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                <DetailRow label={t("inbox.customer.lastActive")} value={hydrated ? formatDateTime(conversationDetail.updatedAt, hydrated) : "--"} icon={<svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>} />
                {conversationDetail.assignedTo && (
                  <DetailRow label={t("inbox.assignTo")} value={conversationDetail.assignedTo.email} icon={<User size={14} className="text-slate-400" />} />
                )}
              </div>
            )}

            {/* Notes */}
            {detailTab === "notes" && (
              <div className="px-5 py-4 flex-1 flex flex-col">
                <div className="mb-3">
                  <textarea value={noteBody} onChange={e => setNoteBody(e.target.value)}
                    placeholder={t("inbox.notePlaceholder")} maxLength={2000} rows={3}
                    className="w-full px-3 py-2.5 text-[13px] border border-slate-200 rounded-xl bg-slate-50/50 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white resize-none transition-all" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-300">{noteBody.length}/2000</span>
                    <button onClick={handleAddNote} disabled={!noteBody.trim() || isSubmittingNote}
                      className="px-3.5 py-1.5 text-[12px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      {t("inbox.noteSubmit")}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {notes.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                      </div>
                      <p className="text-xs text-slate-400">{t("inbox.notes.empty")}</p>
                    </div>
                  ) : notes.map(note => (
                    <div key={note.id} className="flex gap-2.5 p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ${getAvatarColor(note.author.email)}`}>
                        {getInitials(note.author.email)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-semibold text-slate-700">{note.author.email.split("@")[0]}</span>
                          <span className="text-[10px] text-slate-400" suppressHydrationWarning>{formatDateTime(note.createdAt, hydrated)}</span>
                        </div>
                        <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap">{note.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl shadow-2xl shadow-slate-900/30 flex items-center gap-2.5 ring-1 ring-white/10 animate-in slide-in-from-bottom-4">
          <CheckCircle size={15} className="text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} currentPlan={planKey} reason={upgradeReason} requiredPlan={upgradeRequiredPlan} />
    </div>
  );
}

/* ─── Inline Sub-components ─── */

function DetailRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-[13px] text-slate-800 font-medium break-words truncate">{value || "\u2014"}</div>
      </div>
    </div>
  );
}
