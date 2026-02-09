"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import ErrorBanner from "@/components/ErrorBanner";
import { useHydrated } from "@/hooks/useHydrated";
import { usePortalInboxNotification } from "@/contexts/PortalInboxNotificationContext";
import {
  Search, X, Send, User, Pause, XCircle,
  MessageSquare, Paperclip, Smile,
  Headphones, ArrowLeft, PanelRightOpen, PanelRightClose,
  Copy,
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

const AVATAR_COLORS = [
  "bg-teal-600", "bg-blue-500", "bg-emerald-600", "bg-purple-500",
  "bg-pink-500", "bg-amber-500", "bg-cyan-600", "bg-rose-500",
  "bg-indigo-500", "bg-sky-500",
];
function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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

  // Filters
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [assignedFilter, setAssignedFilter] = useState<"any" | "me" | "unassigned">("any");
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

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2500); }, []);

  // Typing indicator
  const { emitAgentTyping, emitAgentTypingStop, onUserTyping, onUserTypingStop } = usePortalInboxNotification();
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
    } catch { setError(t("dashboard.failedLoadConversations")); }
    finally { setIsLoading(false); }
  }, [statusFilter, assignedFilter, debouncedSearch, t]);

  useEffect(() => { if (!authLoading) fetchConversations(); }, [authLoading, fetchConversations]);

  // Poll for new conversations (e.g. from widget) so inbox updates without manual refresh
  useEffect(() => {
    if (authLoading || !user) return;
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [authLoading, user, fetchConversations]);

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
    fetchNotes(id);
    await fetchConversations();
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

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === conversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map(c => c.id)));
    }
  }, [conversations, selectedIds.size]);

  const toggleSelectConversation = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const executeBulk = useCallback(async (action: "OPEN" | "CLOSE" | "ASSIGN" | "UNASSIGN") => {
    if (selectedIds.size === 0) return;
    try {
      const res = await portalApiFetch("/portal/conversations/bulk", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      if (!res.ok) throw new Error();
      showToast(t("inbox.bulk.updated"));
      setSelectedIds(new Set());
      fetchConversations();
    } catch {
      showToast(t("common.error"));
    }
  }, [selectedIds, t, showToast, fetchConversations]);

  // Auto-select from URL
  useEffect(() => {
    if (typeof window === "undefined" || authLoading || conversations.length === 0) return;
    const c = searchParams.get("c");
    if (c && !selectedConversationId && conversations.find(cv => cv.id === c)) selectConversation(c);
  }, [authLoading, conversations, searchParams, selectedConversationId, selectConversation]);

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

  // Filter counts
  const counts = {
    all: conversations.length,
    assignedToMe: conversations.filter(c => c.assignedTo?.id === user?.id).length,
    unassigned: conversations.filter(c => !c.assignedTo).length,
    open: conversations.filter(c => c.status === "OPEN").length,
    closed: conversations.filter(c => c.status === "CLOSED").length,
  };

  if (authLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#1A1A2E] animate-spin" /></div>;
  }

  return (
    <div className="fixed inset-0 top-16 lg:left-[260px] flex overflow-hidden bg-slate-50 z-10">

      {/* ═══ PANEL 1: SOL — Filtreler + Konuşma Listesi ═══ */}
      <div className={`w-full sm:w-[340px] lg:w-[360px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-white ${mobileView !== "list" ? "hidden sm:flex" : "flex"}`}>

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-slate-700" />
            <h2 className="text-[15px] font-semibold text-slate-800">{t("inbox.sidebar.inbox")}</h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-semibold rounded tabular-nums">
              {conversations.length}
            </span>
          </div>
          <button
            onClick={() => fetchConversations()}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title={t("common.refresh")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" /></svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t("inbox.sidebar.search")}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all" />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 flex-wrap">
          <FilterChip label={t("inbox.statusOpen")} active={statusFilter === "OPEN"} onClick={() => setStatusFilter(statusFilter === "OPEN" ? "ALL" : "OPEN")} />
          <FilterChip label={t("inbox.statusClosed")} active={statusFilter === "CLOSED"} onClick={() => setStatusFilter(statusFilter === "CLOSED" ? "ALL" : "CLOSED")} />
          <FilterChip label={t("inbox.filters.assignedMe")} active={assignedFilter === "me"} onClick={() => setAssignedFilter(assignedFilter === "me" ? "any" : "me")} />
          <FilterChip label={t("inbox.filters.unassigned")} active={assignedFilter === "unassigned"} onClick={() => setAssignedFilter(assignedFilter === "unassigned" ? "any" : "unassigned")} />
        </div>

        {/* Filter Groups (collapsible sections) */}
        <div className="border-b border-slate-100 max-h-[200px] overflow-y-auto">
          <FilterSection title={t("inbox.sidebar.inbox")}>
            <FilterRow label={t("inbox.filters.all")} count={counts.all} active={assignedFilter === "any"} onClick={() => setAssignedFilter("any")} />
            <FilterRow label={t("inbox.filters.assignedMe")} count={counts.assignedToMe} active={assignedFilter === "me"} onClick={() => setAssignedFilter("me")} />
            <FilterRow label={t("inbox.filters.unassigned")} count={counts.unassigned} active={assignedFilter === "unassigned"} onClick={() => setAssignedFilter("unassigned")} />
          </FilterSection>
          <FilterSection title={t("inbox.sidebar.status")}>
            <FilterRow label={t("inbox.sidebar.all")} count={counts.all} active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} />
            <FilterRow label={t("inbox.statusOpen")} count={counts.open} active={statusFilter === "OPEN"} onClick={() => setStatusFilter("OPEN")} />
            <FilterRow label={t("inbox.statusClosed")} count={counts.closed} active={statusFilter === "CLOSED"} onClick={() => setStatusFilter("CLOSED")} />
          </FilterSection>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="px-3 py-2.5 border-b border-slate-200 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-900">{selectedIds.size} {t("inbox.bulk.selectedCount")}</span>
              <button onClick={toggleSelectAll} className="text-xs text-blue-600 hover:text-blue-700 font-medium">{selectedIds.size === conversations.length ? t("inbox.bulk.clearSelection") : t("inbox.bulk.selectAll")}</button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => executeBulk("OPEN")} className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50">{t("inbox.bulk.open")}</button>
              <button onClick={() => executeBulk("CLOSE")} className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50">{t("inbox.bulk.close")}</button>
            </div>
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {error && <div className="m-3"><ErrorBanner message={error} /></div>}
          {isLoading && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" /></div>
          ) : conversations.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <MessageSquare size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500 mb-1">{t("inbox.empty.title")}</p>
              <p className="text-xs text-slate-400">{t("inbox.empty.desc")}</p>
            </div>
          ) : conversations.map(conv => {
            const name = displayName(conv);
            const active = conv.id === selectedConversationId;
            const isSelected = selectedIds.has(conv.id);
            return (
              <div key={conv.id}
                className={`group px-4 py-3.5 cursor-pointer border-b border-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${active ? "bg-blue-50/60" : "hover:bg-slate-50"} ${conv.hasUnreadFromUser ? "bg-blue-50/40" : ""}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelectConversation(conv.id)} onClick={e => e.stopPropagation()}
                    className="mt-3 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-2 focus:ring-offset-0 cursor-pointer" />
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white ${getAvatarColor(conv.id)}`}
                    onClick={() => selectConversation(conv.id)} role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectConversation(conv.id); } }}
                    aria-label={`${t("inbox.sidebar.inbox")}: ${name}`}>
                    {getInitials(name)}
                  </div>
                    {conv.hasUnreadFromUser && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" title={t("inbox.unread")} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => selectConversation(conv.id)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-semibold truncate ${conv.hasUnreadFromUser ? "text-slate-900 font-bold" : "text-slate-800"}`}>{name}</span>
                      <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2" suppressHydrationWarning>{formatTime(conv.updatedAt, hydrated)}</span>
                    </div>
                    {conv.preview && <p className="text-[13px] text-slate-600 truncate">{conv.preview.text}</p>}
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {conv.assignedTo && <span className="flex items-center gap-1"><User size={10} />{conv.assignedTo.email.split("@")[0]}</span>}
                        {conv.status === "CLOSED" && <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-semibold">{t("inbox.statusClosed")}</span>}
                      </div>
                      {conv.messageCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 bg-[#F26B3A] text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {conv.messageCount > 99 ? "99+" : conv.messageCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {nextCursor && (
            <div className="px-4 py-3 text-center">
              <button onClick={() => fetchConversations(nextCursor, true)} disabled={isLoading}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium">{t("inbox.loadMore")}</button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ PANEL 2: ORTA — Chat Thread ═══ */}
      <div className={`flex-1 flex flex-col bg-white min-w-0 ${mobileView !== "chat" && mobileView !== "list" ? "hidden sm:flex" : mobileView === "list" ? "hidden sm:flex" : "flex"}`}>
        {!selectedConversationId ? (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={26} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">{t("inbox.detail.noSelection")}</p>
              <p className="text-xs text-slate-500">{t("inbox.detail.selectHint")}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={closePanel} className="sm:hidden text-slate-500 hover:text-slate-700"><ArrowLeft size={18} /></button>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${getAvatarColor(selectedConversationId)}`}>
                  {selectedConv ? getInitials(displayName(selectedConv)) : "?"}
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-slate-900">{selectedConv ? displayName(selectedConv) : ""}</div>
                  {userTypingConvId === selectedConversationId ? (
                    <div className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                      <span className="inline-flex gap-0.5">
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      {t("inbox.typing.userTyping")}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {isOpen ? t("inbox.sidebar.online") : t("inbox.sidebar.offline")}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyLink}
                  className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all"
                  title={t("inbox.detail.copyLink")}>
                  <Copy size={14} /> <span className="hidden lg:inline">{t("inbox.detail.copyLink")}</span>
                </button>
                <button onClick={() => handleStatusChange(isOpen ? "CLOSED" : "OPEN")} disabled={isUpdating}
                  className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50 flex items-center gap-1.5 transition-all">
                  <Pause size={14} /> <span className="hidden sm:inline">{t("inbox.chat.pause")}</span>
                </button>
                <button onClick={() => handleStatusChange("CLOSED")} disabled={isUpdating || !isOpen}
                  className="px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5 transition-all">
                  <XCircle size={14} /> <span className="hidden sm:inline">{t("inbox.chat.close")}</span>
                </button>
                <select value={conversationDetail?.assignedTo?.id || ""} onChange={e => handleAssignmentChange(e.target.value || null)}
                  disabled={isUpdating} className="hidden lg:block px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50">
                  <option value="">{t("inbox.chat.assign")}</option>
                  {teamMembers.filter(m => m.isActive).map(m => <option key={m.id} value={m.id}>{m.email.split("@")[0]}</option>)}
                </select>
                <button onClick={() => setShowRightPanel(!showRightPanel)}
                  className="hidden lg:flex p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                  title={showRightPanel ? t("inbox.detail.closePanel") : t("inbox.detail.details")}>
                  {showRightPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                </button>
                <button onClick={() => setMobileView("details")} className="lg:hidden p-1.5 border border-slate-200 rounded-lg text-slate-500"><User size={14} /></button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-50">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-12"><div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" /></div>
              ) : conversationDetail?.messages.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400">{t("inbox.chat.noMessages")}</div>
              ) : conversationDetail?.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                  {msg.role === "user" && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mr-2.5 ${getAvatarColor(selectedConversationId || "")}`}>
                      {selectedConv ? getInitials(displayName(selectedConv)) : "?"}
                    </div>
                  )}
                  <div className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                      : "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-sm shadow-md"
                  }`}>
                    <p className="text-[14px] leading-relaxed">{msg.content}</p>
                    <div className={`text-[11px] mt-1.5 text-right ${msg.role === "user" ? "text-slate-400" : "text-white/70"}`} suppressHydrationWarning>
                      {formatTime(msg.timestamp, hydrated)}
                    </div>
                  </div>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 ml-2.5 bg-blue-600 shadow-sm">
                      <Headphones size={13} />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            <div className="px-5 py-2 bg-white border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
              <button disabled className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-full text-slate-500 bg-slate-50 cursor-not-allowed hover:bg-slate-100 transition-colors">
                {t("inbox.quickReply.thanks")}
              </button>
              <button disabled className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-full text-slate-500 bg-slate-50 cursor-not-allowed hover:bg-slate-100 transition-colors">
                {t("inbox.quickReply.followUp")}
              </button>
            </div>

            {/* Composer — send agent reply (enabled; POST /portal/conversations/:id/messages) */}
            <div className="px-5 py-3 bg-white border-t border-slate-200 flex-shrink-0" role="form" aria-label={t("inbox.chat.replyForm")}>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-slate-300">
                  <button disabled title={t("inbox.chat.notSupported")} className="cursor-not-allowed hover:text-slate-400"><Paperclip size={18} /></button>
                  <button disabled title={t("inbox.chat.notSupported")} className="cursor-not-allowed hover:text-slate-400"><Smile size={18} /></button>
                </div>
                <input
                  type="text"
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
                  className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={!replyBody.trim() || isSendingReply}
                  aria-label={t("inbox.chat.send")}
                  className="p-2.5 bg-[#F26B3A] text-white rounded-lg hover:bg-[#e55a2d] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  {isSendingReply ? <span className="text-sm">...</span> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ PANEL 3: SAĞ — Customer Details + Notes ═══ */}
      <div className={`w-[340px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-y-auto ${
        mobileView === "details"
          ? "flex fixed inset-0 z-50 w-full bg-white lg:static lg:w-[340px]"
          : showRightPanel ? "hidden lg:flex" : "hidden"
      }`}>
        {!selectedConversationId || !conversationDetail ? (
          <div className="flex-1 flex items-center justify-center"><p className="text-sm text-slate-400">{t("inbox.detail.noSelection")}</p></div>
        ) : (
          <>
            {/* Mobile back */}
            <div className="lg:hidden px-4 py-3 border-b border-slate-100">
              <button onClick={() => setMobileView("chat")} className="flex items-center gap-1.5 text-sm text-slate-600">
                <ArrowLeft size={16} /> {t("inbox.mobileBack")}
              </button>
            </div>

            {/* Customer header */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white ${getAvatarColor(selectedConversationId)}`}>
                  {selectedConv ? getInitials(displayName(selectedConv)) : "?"}
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-slate-900">{selectedConv ? displayName(selectedConv) : ""}</div>
                  <div className="text-xs text-slate-500">{t("inbox.customer.title")}</div>
                </div>
              </div>
            </div>

            {/* Detail Tabs (details / notes) */}
            <div className="flex border-b border-slate-200">
              <button onClick={() => setDetailTab("details")}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${detailTab === "details" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
                {t("inbox.detail.details")}
              </button>
              <button onClick={() => setDetailTab("notes")}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${detailTab === "notes" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
                {t("inbox.detail.notes")}
              </button>
            </div>

            {/* Attributes (visible when details tab active) */}
            {detailTab === "details" && (
            <div className="px-5 py-4 border-b border-slate-100 space-y-3.5">
              <DetailRow label={t("inbox.customer.channel")} value="Web Widget" />
              <DetailRow label={t("inbox.customer.id")} value={selectedConversationId.substring(0, 16)} />
              <DetailRow label={t("inbox.customer.phone")} value="+5267628000000" />
              <DetailRow label={t("inbox.customer.address")} value="5467 Richmond View Suite 511, Sunrise, KY" />
            </div>
            )}

            {/* Notes (visible when notes tab active) */}
            {detailTab === "notes" && (
            <div className="px-5 py-4 flex-1 flex flex-col">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{t("inbox.notes.title")}</h3>
              <div className="mb-4">
                <textarea value={noteBody} onChange={e => setNoteBody(e.target.value)}
                  placeholder={t("inbox.notePlaceholder")} maxLength={2000} rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all" />
                <div className="flex items-center justify-end mt-2">
                  <button onClick={handleAddNote} disabled={!noteBody.trim() || isSubmittingNote}
                    className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    {t("inbox.noteSubmit")}
                  </button>
                </div>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto">
                {notes.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">{t("inbox.notes.empty")}</p>
                ) : notes.map(note => (
                  <div key={note.id} className="flex gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${getAvatarColor(note.author.email)}`}>
                      {getInitials(note.author.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-800">{note.author.email.split("@")[0]}</span>
                        <span className="text-[11px] text-slate-400" suppressHydrationWarning>{formatDateTime(note.createdAt, hydrated)}</span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.body}</p>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#1A1A2E] text-white text-sm rounded-lg shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

/* ─── Inline Sub-components ─── */

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 text-[11px] font-medium rounded-full flex items-center gap-1 transition-all whitespace-nowrap ${
        active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}>
      {label}
      {active && <X size={11} />}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-2">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FilterRow({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
        active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
      }`}>
      <span>{label}</span>
      <span className={`text-[11px] font-semibold tabular-nums ${active ? "text-blue-600" : "text-slate-400"}`}>{count}</span>
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-slate-500 font-medium mb-0.5">{label}</div>
        <div className="text-sm text-slate-800 font-medium break-words">{value || "—"}</div>
      </div>
    </div>
  );
}
