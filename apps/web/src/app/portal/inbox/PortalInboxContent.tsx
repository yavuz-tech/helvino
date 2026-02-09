"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import ErrorBanner from "@/components/ErrorBanner";
import { useHydrated } from "@/hooks/useHydrated";
import { usePortalInboxNotification } from "@/contexts/PortalInboxNotificationContext";
import Link from "next/link";
import {
  Search, Send, User, Pause, XCircle,
  MessageSquare, Paperclip, Smile,
  ArrowLeft, PanelRightOpen, PanelRightClose,
  Copy, CheckCircle, Bot, Sparkles,
} from "lucide-react";

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
  hasUnreadFromUser?: boolean;
  preview: { text: string; from: string } | null;
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

function displayName(conv: ConversationListItem): string {
  if (conv.preview?.from && conv.preview.from !== "assistant") return conv.preview.from;
  return `Visitor #${conv.id.substring(0, 6)}`;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w`;
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

  // Bulk select

  // Toast
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
      if (debouncedSearch) p.set("q", debouncedSearch);
      p.set("limit", "50");
      if (cursorVal) p.set("cursor", cursorVal);
      const res = await portalApiFetch(`/portal/conversations?${p.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (append) setConversations(prev => [...prev, ...(data.items || [])]);
      else setConversations(data.items || []);
      setNextCursor(data.nextCursor || null);
      fetchViewCounts();
    } catch { setError(t("dashboard.failedLoadConversations")); }
    finally { setIsLoading(false); }
  }, [statusFilter, assignedFilter, debouncedSearch, t, fetchViewCounts]);

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

  const selectConversation = useCallback(async (id: string) => {
    setSelectedConversationId(id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, hasUnreadFromUser: false } : c));
    setMobileView("chat");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("c", id);
      router.replace(`/portal/inbox?${params.toString()}`, { scroll: false });
    }
    await fetchConversationDetail(id);
    // Header bell: refetch unread count immediately (API already marked conversation read in GET detail)
    requestAnimationFrame(() => {
      try {
        window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
      } catch { /* */ }
    });
    fetchNotes(id);
    await fetchConversations();
    requestAnimationFrame(() => {
      try {
        window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
      } catch { /* */ }
    });
  }, [router, fetchConversationDetail, fetchNotes, fetchConversations]);

  const closePanel = useCallback(() => {
    setSelectedConversationId(null); setConversationDetail(null); setNotes([]); setMobileView("list");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("c");
      router.replace(params.toString() ? `/portal/inbox?${params.toString()}` : "/portal/inbox", { scroll: false });
    }
  }, [router]);

  const copyLink = useCallback(() => {
    if (!selectedConversationId) return;
    const url = `${window.location.origin}/portal/inbox?c=${selectedConversationId}`;
    navigator.clipboard.writeText(url).then(() => showToast(t("inbox.detail.linkCopied")));
  }, [selectedConversationId, showToast, t]);

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
        setConversations(prev => prev.map(c => c.id === conversationId
          ? { ...c, hasUnreadFromUser: false, messageCount: c.messageCount + 1, updatedAt: nowIso, preview: c.preview ? { ...c.preview, text: previewText } : { text: previewText, from: "user" } }
          : c
        ));
        fetchConversationDetail(conversationId).then(() => {
          try {
            window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
          } catch { /* */ }
        });
        return;
      }

      setConversations(prev => prev.map(c => c.id === conversationId
        ? { ...c, hasUnreadFromUser: true, messageCount: c.messageCount + 1, updatedAt: nowIso, preview: c.preview ? { ...c.preview, text: previewText } : { text: previewText, from: "user" } }
        : c
      ));
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

  const totalOpen = viewCounts.unassigned + viewCounts.myOpen;

  return (
    <div className="fixed inset-0 top-16 lg:left-[260px] flex overflow-hidden bg-[#f8f9fb] z-10">

      {/* ═══ PANEL 1: LEFT SIDEBAR ═══ */}
      <div className={`w-full sm:w-[320px] lg:w-[340px] flex-shrink-0 border-r border-slate-200/80 flex flex-col bg-white ${mobileView !== "list" ? "hidden sm:flex" : "flex"}`}>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="relative group">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t("inbox.sidebar.search")}
              className="w-full pl-10 pr-4 py-2.5 text-[13px] border border-slate-200/80 rounded-xl bg-slate-50/60 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all shadow-sm" />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex rounded-xl bg-slate-100/70 p-1 gap-0.5">
            <button onClick={() => { setStatusFilter("OPEN"); setAssignedFilter("unassigned"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                statusFilter === "OPEN" && assignedFilter === "unassigned" ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.04]" : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
              }`}>
              {t("inbox.filterUnassigned")}
              {viewCounts.unassigned > 0 && (
                <span className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                  statusFilter === "OPEN" && assignedFilter === "unassigned" ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30" : "bg-slate-200/80 text-slate-600"
                }`}>{viewCounts.unassigned > 99 ? "99+" : viewCounts.unassigned}</span>
              )}
            </button>
            <button onClick={() => { setStatusFilter("OPEN"); setAssignedFilter("me"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                statusFilter === "OPEN" && assignedFilter === "me" ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.04]" : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
              }`}>
              {t("inbox.filterMyOpen")}
              {viewCounts.myOpen > 0 && (
                <span className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                  statusFilter === "OPEN" && assignedFilter === "me" ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30" : "bg-slate-200/80 text-slate-600"
                }`}>{viewCounts.myOpen}</span>
              )}
            </button>
            <button onClick={() => { setStatusFilter("CLOSED"); setAssignedFilter("any"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                statusFilter === "CLOSED" ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.04]" : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
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

        {/* List header */}
        <div className="px-4 py-2 border-t border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{currentViewLabel}</span>
          <button onClick={() => fetchConversations()} disabled={isLoading}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors disabled:opacity-50" title={t("common.refresh")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" /></svg>
          </button>
        </div>

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
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-200/60">
                <MessageSquare size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-700 mb-1">{emptyListHint}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{t("inbox.empty.desc")}</p>
            </div>
          ) : conversations.map(conv => {
            const name = displayName(conv);
            const active = conv.id === selectedConversationId;
            const hasUnread = !!conv.hasUnreadFromUser;
            return (
              <div key={conv.id} onClick={() => selectConversation(conv.id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectConversation(conv.id); } }}
                className={`group relative mx-2 my-1 px-3 py-3 cursor-pointer rounded-xl transition-all duration-200 ${
                  active
                    ? "bg-blue-50/80 ring-1 ring-blue-200/60 shadow-sm"
                    : hasUnread
                      ? "bg-white hover:bg-slate-50/80 ring-1 ring-blue-100/50"
                      : "hover:bg-slate-50/60"
                }`}>
                {/* Active indicator bar */}
                {active && <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-blue-500 rounded-r-full" />}

                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shadow-sm ${getAvatarColor(conv.id)}`}>
                      {getInitials(name)}
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm shadow-blue-500/30">
                        <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-40" />
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-[13px] truncate ${hasUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>{name}</span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums font-medium" suppressHydrationWarning>{hydrated ? formatRelativeTime(conv.updatedAt) : formatTime(conv.updatedAt, hydrated)}</span>
                    </div>
                    {conv.preview && <p className={`text-[12px] leading-snug truncate mb-1.5 ${hasUnread ? "text-slate-700 font-medium" : "text-slate-500"}`}>{conv.preview.text}</p>}
                    <div className="flex items-center gap-1.5">
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
                      <span className="text-[10px] text-slate-300 tabular-nums font-medium">{conv.messageCount} msg</span>
                    </div>
                  </div>

                  {/* Unread badge */}
                  {hasUnread && conv.messageCount > 0 && (
                    <span className="mt-1 min-w-[22px] h-[22px] px-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-500/25">
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
          /* ── Rich Empty State — Dashboard-like ── */
          <div className="flex-1 flex flex-col bg-[#f8f9fb] overflow-y-auto">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-5 p-6 pb-3">
              <div className="group relative bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-lg hover:shadow-amber-500/[0.04] hover:border-amber-200/60 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-50 to-transparent rounded-bl-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-500/20"><MessageSquare size={17} className="text-white" /></div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("inbox.filterUnassigned")}</span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">{viewCounts.unassigned}</div>
                </div>
              </div>
              <div className="group relative bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-lg hover:shadow-blue-500/[0.04] hover:border-blue-200/60 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20"><User size={17} className="text-white" /></div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("inbox.filterMyOpen")}</span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">{viewCounts.myOpen}</div>
                </div>
              </div>
              <div className="group relative bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-lg hover:shadow-emerald-500/[0.04] hover:border-emerald-200/60 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-emerald-500/20"><CheckCircle size={17} className="text-white" /></div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("inbox.filterSolved")}</span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">{viewCounts.solved}</div>
                </div>
              </div>
            </div>

            {/* Welcome hero */}
            <div className="flex-1 flex items-center justify-center px-8">
              <div className="max-w-xl text-center">
                <div className="relative w-20 h-20 mx-auto mb-8">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/25 rotate-3" />
                  <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <MessageSquare size={32} className="text-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-3 tracking-tight">{t("inbox.empty.welcomeTitle")}</h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-10 max-w-md mx-auto">{t("inbox.empty.welcomeDesc")}</p>

                {/* Feature tips */}
                <div className="grid grid-cols-3 gap-5 mb-10 text-left">
                  <div className="group bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-lg hover:border-blue-200/60 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-3.5 shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg></div>
                    <p className="text-[13px] font-bold text-slate-800 mb-1">{t("inbox.empty.tip1Title")}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{t("inbox.empty.tip1Desc")}</p>
                  </div>
                  <div className="group bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-lg hover:border-emerald-200/60 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3.5 shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg></div>
                    <p className="text-[13px] font-bold text-slate-800 mb-1">{t("inbox.empty.tip2Title")}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{t("inbox.empty.tip2Desc")}</p>
                  </div>
                  <div className="group bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-lg hover:border-amber-200/60 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-3.5 shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></div>
                    <p className="text-[13px] font-bold text-slate-800 mb-1">{t("inbox.empty.tip3Title")}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{t("inbox.empty.tip3Desc")}</p>
                  </div>
                </div>

                <Link href="/demo-chat"
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 duration-200">
                  <MessageSquare size={16} />
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
                    {selectedConv ? getInitials(displayName(selectedConv)) : "?"}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isOpen ? "bg-emerald-400 shadow-sm shadow-emerald-400/40" : "bg-slate-300"}`} />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-900">{selectedConv ? displayName(selectedConv) : ""}</div>
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
                      {selectedConv ? getInitials(displayName(selectedConv)) : "?"}
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
                  {selectedConv ? getInitials(displayName(selectedConv)) : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-slate-900">{selectedConv ? displayName(selectedConv) : ""}</div>
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
                  <div className="text-sm font-extrabold text-slate-900 tabular-nums" suppressHydrationWarning>{hydrated ? formatRelativeTime(conversationDetail.createdAt) : "--"}</div>
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
