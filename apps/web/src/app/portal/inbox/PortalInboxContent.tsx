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
import { colors, fonts } from "@/lib/design-tokens";
import {
  Search, Send, User,
  MessageSquare, Paperclip, Smile,
  ArrowLeft, PanelRightOpen, PanelRightClose,
  Copy, CheckCircle, Bot, Sparkles,
  Lock, FileText, CheckSquare, Square, X,
  AlertCircle, Star, Tag,
} from "lucide-react";
import { premiumToast } from "@/components/PremiumToast";
import { sanitizePlainText } from "@/utils/sanitize";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  formatDateTime,
  formatRelativeTime,
  formatTime,
  getAvatarColor,
  getInitials,
  sanitizeConversationMessage as sanitizeConversationMsg,
} from "./inbox-utils";

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
  isAIGenerated?: boolean;
  aiProvider?: string | null;
  aiModel?: string | null;
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

const inboxSimulateButtonGradient = `linear-gradient(135deg, #FDB462, ${colors.brand.primary})`;
const WARM_BORDER = "#F3E8D8";

const CANNED_RESPONSES: Record<string, string[]> = {
  greeting: [
    "inbox.canned.reply.greeting.1",
    "inbox.canned.reply.greeting.2",
  ],
  pricing: [
    "inbox.canned.reply.pricing.1",
    "inbox.canned.reply.pricing.2",
  ],
  technical: [
    "inbox.canned.reply.technical.1",
    "inbox.canned.reply.technical.2",
  ],
  closing: [
    "inbox.canned.reply.closing.1",
    "inbox.canned.reply.closing.2",
  ],
};

const EMOJIS = ["😊","👋","🎯","🔧","📋","✅","❤️","🚀","💡","👍","🙏","😄","🎉","💪","⭐","🔥","💬","✨","🤝","😉","👀","💯","🏆","🙌"];

function displayName(conv: ConversationListItem, t: (key: string) => string): string {
  // preview.from contains role ("user"/"assistant"), NOT a display name — always use generated name
  return t("common.visitorNumber").replace("{id}", conv.id.substring(0, 6));
}

/** Strip HTML tags and [system]/[note] prefixes from preview text */
function cleanPreviewText(text: string): string {
  return text
    .replace(/^\[(system|note)\]\s*/i, "")
    .replace(/<[^>]*>/g, "")
    .slice(0, 80);
}

/** Translate structured system message keys to localized text */
function translateSystemMessage(raw: string, t: (key: string) => string): string {
  const content = raw.replace(/^\[system\]\s*/i, "").trim();
  // Format: KEY:param or just KEY
  const [key, param] = content.split(":");
  switch (key) {
    case "conversation_closed":
      return `✅ ${t("inbox.system.conversationClosed" as never).replace("{actor}", param || "Agent")}`;
    case "ai_handoff":
      return `🤖 ${t("inbox.system.aiHandoff" as never)}`;
    case "agent_joined":
      return `🔄 ${t("inbox.system.agentJoined" as never).replace("{actor}", param || "Agent")}`;
    default:
      // Legacy messages (before structured format) — show as-is
      return content;
  }
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

function normalizeConversationListItems(rawItems: unknown): ConversationListItem[] {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items
    .map((raw): ConversationListItem | null => {
      const c = (raw || {}) as Record<string, unknown>;
      const id = typeof c.id === "string" ? c.id : "";
      if (!id) return null;
      const status = typeof c.status === "string" ? c.status : "OPEN";
      const updatedAt =
        typeof c.updatedAt === "string" && c.updatedAt
          ? c.updatedAt
          : new Date().toISOString();
      const createdAt =
        typeof c.createdAt === "string" && c.createdAt
          ? c.createdAt
          : updatedAt;
      const lastMessageAt =
        typeof c.lastMessageAt === "string" && c.lastMessageAt
          ? c.lastMessageAt
          : updatedAt;
      const previewObj =
        c.preview && typeof c.preview === "object"
          ? (c.preview as Record<string, unknown>)
          : null;
      const previewText = typeof previewObj?.text === "string" ? previewObj.text : "";
      const previewFrom = typeof previewObj?.from === "string" ? previewObj.from : "";
      return {
        id,
        status,
        assignedToOrgUserId:
          typeof c.assignedToOrgUserId === "string" ? c.assignedToOrgUserId : null,
        assignedTo:
          c.assignedTo && typeof c.assignedTo === "object"
            ? (c.assignedTo as { id: string; email: string; role: string })
            : null,
        closedAt: typeof c.closedAt === "string" ? c.closedAt : null,
        createdAt,
        updatedAt,
        messageCount: Number(c.messageCount || 0) || 0,
        lastMessageAt,
        noteCount: Number(c.noteCount || 0) || 0,
        hasUnreadMessages: Boolean(c.hasUnreadMessages),
        preview: previewText || previewFrom ? { text: previewText, from: previewFrom } : null,
        slaStatus:
          c.slaStatus === "ok" || c.slaStatus === "warning" || c.slaStatus === "breached"
            ? c.slaStatus
            : null,
        slaDueAt: typeof c.slaDueAt === "string" ? c.slaDueAt : null,
      };
    })
    .filter((x): x is ConversationListItem => Boolean(x));
}

function sanitizeConversationDetail(detail: ConversationDetail): ConversationDetail {
  return {
    ...detail,
    messages: (detail.messages || []).map((message) => sanitizeConversationMsg(message)),
  };
}

function conversationSignature(c: ConversationListItem): string {
  // Include only fields that affect rendering and ordering.
  return [
    c.id,
    c.status,
    c.assignedToOrgUserId || "",
    c.closedAt || "",
    c.updatedAt,
    String(c.messageCount),
    c.lastMessageAt,
    String(c.noteCount),
    c.hasUnreadMessages ? "1" : "0",
    c.preview?.from || "",
    c.preview?.text || "",
    c.slaStatus || "",
    c.slaDueAt || "",
  ].join("|");
}

function areConversationListsEquivalent(a: ConversationListItem[], b: ConversationListItem[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (conversationSignature(a[i]!) !== conversationSignature(b[i]!)) return false;
  }
  return true;
}

function mergeConversationDetail(prev: ConversationDetail | null, nextRaw: ConversationDetail): ConversationDetail | null {
  const next = sanitizeConversationDetail(nextRaw);
  if (!prev || prev.id !== next.id) return next;

  // Merge messages by id (append-only in normal operation). Avoid replacing the array if unchanged
  // to preserve scroll position and prevent jitter.
  const prevMsgs = prev.messages || [];
  const nextMsgs = next.messages || [];
  if (prevMsgs.length === 0) return next;
  if (nextMsgs.length === 0) return prev;

  const prevById = new Set(prevMsgs.map((m) => m.id));
  let hasNew = false;
  const merged: Message[] = [...prevMsgs];
  for (const m of nextMsgs) {
    if (!prevById.has(m.id)) {
      merged.push(m);
      hasNew = true;
    }
  }
  // Keep chronological order (API should already do this, but be safe)
  if (hasNew) {
    merged.sort((x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime());
  }

  const metaChanged =
    prev.updatedAt !== next.updatedAt ||
    prev.messageCount !== next.messageCount ||
    prev.status !== next.status ||
    prev.closedAt !== next.closedAt ||
    (prev.assignedTo?.id || null) !== (next.assignedTo?.id || null);

  if (!hasNew && !metaChanged) return prev;

  return {
    ...prev,
    ...next,
    messages: hasNew ? merged : prevMsgs,
  };
}

/* ═══════════════════════════════════════════════════════════════ */
export default function PortalInboxContent() {
  void fonts;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const hydrated = useHydrated();
  const { user, loading: authLoading } = usePortalAuth();
  const debug = (...args: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(...args);
    }
  };

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const hasLoadedConversationsRef = useRef(false);

  // Filters — default Unassigned so new messages (OPEN + unassigned) show there, not under Solved
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [assignedFilter, setAssignedFilter] = useState<"any" | "me" | "unassigned">("unassigned");
  const [unreadOnly, setUnreadOnly] = useState(() => searchParams.get("unread") === "1");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Selected
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const fetchDetailAbortRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);

  // Notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Reply (agent message)
  const [replyBody, setReplyBody] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Team
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Panels
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [detailTab, setDetailTab] = useState<"details" | "notes">("details");
  const [sidebarNoteText, setSidebarNoteText] = useState("");

  // LIVE CONVERSATIONS counts (Unassigned / My open / Solved) — from API
  const [viewCounts, setViewCounts] = useState({ unassigned: 0, myOpen: 0, solved: 0 });

  // Plan info
  const [planKey, setPlanKey] = useState<string>("free");
  const normalizedPlanKey = String(planKey || "free").trim().toLowerCase();
  // Plan hierarchy: free=0, starter=1, pro=2, business=3, enterprise=4
  const planRank = normalizedPlanKey === "enterprise"
    ? 4
    : normalizedPlanKey === "business"
      ? 3
      : normalizedPlanKey === "pro"
        ? 2
        : normalizedPlanKey === "starter"
          ? 1
          : 0;
  const isPro = planRank >= 2;       // Pro, Business, Enterprise
  const isStarter = planRank >= 1;   // Starter+
  const isBusiness = planRank >= 3;  // Business, Enterprise
  const isProPlus = isPro;
  const [upgradeModal, setUpgradeModal] = useState<{ show: boolean; feature: string; minPlan: string } | null>(null);
  const maxTagsForPlan = planRank >= 3 ? Infinity : planRank >= 2 ? 50 : planRank >= 1 ? 10 : 2;
  const canUseAiSuggest = planRank >= 2;   // Pro+
  const canUseInternalNotes = planRank >= 1; // Starter+
  const canUseFileUpload = planRank >= 1;   // Starter+
  const canUseFileAttach = canUseFileUpload;
  const canUseTakeover = planRank >= 1;     // Starter+

  // Per-conversation unread count + flash window (rebuilt).
  const [unreadByConversationId, setUnreadByConversationId] = useState<Record<string, number>>({});
  const [flashUntilByConversationId, setFlashUntilByConversationId] = useState<Record<string, number>>({});
  const flashTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Bulk select
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);

  // AI Actions
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [showAiSuggestionPanel, setShowAiSuggestionPanel] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<"suggest" | "summarize" | "translate" | null>(null);

  // Smart filters (PRO+)
  const [smartFilter, setSmartFilter] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCannedPicker, setShowCannedPicker] = useState(false);
  const [selectedCannedCategory, setSelectedCannedCategory] = useState<keyof typeof CANNED_RESPONSES>("greeting");
  const [showTagBar, setShowTagBar] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [conversationTags, setConversationTags] = useState<Record<string, string[]>>({});

  // Toast (now uses premium toast, keep showToast for compatibility)
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2500); }, []);
  const openUpgradeForPlan = useCallback((minPlan: string, feature?: string) => {
    setUpgradeModal({ show: true, feature: feature || minPlan, minPlan });
  }, []);

  // Keep ref in sync with state for use in event handlers (avoids stale closures)
  useEffect(() => { selectedConversationIdRef.current = selectedConversationId; }, [selectedConversationId]);

  // Typing indicator
  const {
    emitAgentTyping,
    emitAgentTypingStop,
    onUserTyping,
    onUserTypingStop,
    socketStatus,
    unreadMap,
    markConversationRead,
  } = usePortalInboxNotification();
  const [userTypingConvId, setUserTypingConvId] = useState<string | null>(null);
  const agentTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("ai-spin-style")) return;
    const style = document.createElement("style");
    style.id = "ai-spin-style";
    style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }, []);

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
    openUpgradeForPlan("pro", "aiQuota");
  }, [openUpgradeForPlan]);
  const handleAiRateLimited = useCallback(() => {
    premiumToast.error({ title: t("inbox.ai.rateLimited" as TranslationKey) });
  }, [t]);

  const fetchAiSuggestion = useCallback(async () => {
    if (!selectedConversationId) return;
    setAiSuggestionLoading(true);
    setAiSuggestion("");
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/ai-suggest`, {
        method: "POST",
        body: JSON.stringify({ locale }),
      });
      const d = await res.json();
      if (res.status === 402) {
        handleAiQuotaError();
        setShowAiSuggestionPanel(false);
        return;
      }
      if (res.status === 429 || d?.code === "RATE_LIMITED") {
        handleAiRateLimited();
        setShowAiSuggestionPanel(false);
        return;
      }
      if (res.ok && d.success && d.suggestion) {
        setAiSuggestion(d.suggestion);
      } else {
        premiumToast.error({ title: d.error || t("inbox.ai.error" as TranslationKey) });
        setShowAiSuggestionPanel(false);
      }
    } catch {
      premiumToast.error({ title: t("inbox.ai.error" as TranslationKey) });
      setShowAiSuggestionPanel(false);
    } finally {
      setAiSuggestionLoading(false);
    }
  }, [selectedConversationId, locale, handleAiQuotaError, handleAiRateLimited, t]);

  const handleAiSuggest = useCallback(async () => {
    if (!selectedConversationId || aiSuggestionLoading || isLoadingDetail) return;
    if (!canUseAiSuggest) {
      openUpgradeForPlan("pro", "aiSuggestion");
      return;
    }
    if (!conversationDetail?.messages?.length) {
      premiumToast.error({ title: t("inbox.ai.noMessagesYet") });
      return;
    }
    setShowAiSuggestionPanel(true);
    await fetchAiSuggestion();
  }, [selectedConversationId, aiSuggestionLoading, isLoadingDetail, canUseAiSuggest, conversationDetail, openUpgradeForPlan, t, fetchAiSuggestion]);

  const handleAiSummarize = useCallback(async () => {
    if (!selectedConversationId || aiLoading || isLoadingDetail) return;
    if (!canUseAiSuggest) { openUpgradeForPlan("pro"); return; }
    if (!conversationDetail?.messages?.length) { premiumToast.error({ title: t("inbox.ai.noMessagesYet") }); return; }
    setAiLoading("summarize");
    setAiSummary(null);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/ai-summarize`, { method: "POST" });
      const d = await res.json();
      if (res.status === 402) { handleAiQuotaError(); return; }
      if (res.status === 429 || d?.code === "RATE_LIMITED") { handleAiRateLimited(); return; }
      if (res.ok && d.ok) {
        setAiSummary(d.summary);
      } else {
        premiumToast.error({ title: d.error || t("inbox.ai.error" as TranslationKey) });
      }
    } catch { premiumToast.error({ title: t("inbox.ai.error" as TranslationKey) }); }
    finally { setAiLoading(null); }
  }, [selectedConversationId, aiLoading, isLoadingDetail, canUseAiSuggest, conversationDetail, handleAiQuotaError, handleAiRateLimited, openUpgradeForPlan, t]);

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
      if (res.status === 429 || d?.code === "RATE_LIMITED") { handleAiRateLimited(); return; }
      if (res.ok && d.ok) {
        setAiSentiment({ sentiment: d.sentiment, summary: d.summary, detectedLanguage: d.detectedLanguage, topics: d.topics });
      } else {
        premiumToast.error({ title: d.error || t("inbox.ai.error" as TranslationKey) });
      }
    } catch { premiumToast.error({ title: t("inbox.ai.error" as TranslationKey) }); }
    finally { setAiLoading(null); }
  }, [selectedConversationId, aiLoading, isLoadingDetail, conversationDetail, handleAiQuotaError, handleAiRateLimited, t]);

  // FREE: AI Quick Reply (single contextual reply)
  const handleAiQuickReply = useCallback(async () => {
    if (!selectedConversationId || aiLoading || isLoadingDetail) return;
    if (!conversationDetail?.messages?.length) { premiumToast.error({ title: t("inbox.ai.noMessagesYet") }); return; }
    setAiLoading("suggest");
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/ai-quick-reply`, { method: "POST" });
      const d = await res.json();
      if (res.status === 402) { handleAiQuotaError(); return; }
      if (res.status === 429 || d?.code === "RATE_LIMITED") { handleAiRateLimited(); return; }
      if (res.ok && d.ok) {
        setReplyBody(d.reply);
        premiumToast.success({ title: t("inbox.ai.quickReplyGenerated") });
      } else {
        premiumToast.error({ title: d.error || t("inbox.ai.error" as TranslationKey) });
      }
    } catch { premiumToast.error({ title: t("inbox.ai.error" as TranslationKey) }); }
    finally { setAiLoading(null); }
  }, [selectedConversationId, aiLoading, isLoadingDetail, conversationDetail, t, handleAiQuotaError, handleAiRateLimited]);

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
      // During background polling we don't want to flip loading state because it
      // forces layout changes and contributes to scroll jitter.
      const isBackgroundRefresh = !append && Boolean(cursorVal === undefined);
      if (!append && !isBackgroundRefresh) setIsLoading(true);
      setError(null);
      const p = new URLSearchParams();
      p.set("status", statusFilter);
      p.set("assigned", assignedFilter);
      if (unreadOnly) p.set("unreadOnly", "1");
      if (debouncedSearch) p.set("q", debouncedSearch);
      p.set("limit", "50");
      if (cursorVal) p.set("cursor", cursorVal);
      let res = await portalApiFetch(`/portal/conversations?${p.toString()}`);
      // One defensive retry for transient 429/5xx issues.
      if (!res.ok && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 300));
        res = await portalApiFetch(`/portal/conversations?${p.toString()}`);
      }
      if (!res.ok) {
        // Keep the current list on transient errors instead of hard-failing the UI.
        if (res.status === 429 || res.status >= 500) return;
        // Query param mismatch/cursor edge-case fallback: try default query once.
        if (res.status === 400 || res.status === 404 || res.status === 422) {
          res = await portalApiFetch("/portal/conversations?status=OPEN&assigned=unassigned&limit=50");
          if (res.ok) {
            const fallbackData = await res.json().catch(() => ({ items: [], nextCursor: null }));
            const safeFallbackList = sortConversations(normalizeConversationListItems(fallbackData?.items));
            setConversations((prev) => (areConversationListsEquivalent(prev, safeFallbackList) ? prev : safeFallbackList));
            setNextCursor(fallbackData?.nextCursor || null);
            hasLoadedConversationsRef.current = true;
            return;
          }
        }
        throw new Error();
      }
      const data = await res.json().catch(() => ({ items: [], nextCursor: null }));
      const nextList = sortConversations(normalizeConversationListItems(data?.items));
      if (append) {
        setConversations((prev) => {
          const merged = new Map<string, ConversationListItem>();
          for (const c of prev) merged.set(c.id, c);
          for (const c of nextList) merged.set(c.id, c);
          return sortConversations(Array.from(merged.values()));
        });
      } else {
        setConversations((prev) => (areConversationListsEquivalent(prev, nextList) ? prev : nextList));
      }
      setNextCursor(data.nextCursor || null);
      hasLoadedConversationsRef.current = true;
      fetchViewCounts();
    } catch {
      // If list was loaded at least once, keep current UI stable and retry silently.
      if (hasLoadedConversationsRef.current) {
        setError(null);
        return;
      }
      setError(t("dashboard.failedLoadConversations"));
    }
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

  // Seed per-conversation unread counts when API only provides a boolean.
  // This keeps the unread badge + decrement logic working even if we don't have exact counts.
  useEffect(() => {
    if (conversations.length === 0) return;
    setUnreadByConversationId((prev) => {
      let changed = false;
      const next: Record<string, number> = { ...prev };
      for (const c of conversations) {
        if (c.hasUnreadMessages && !Number.isFinite(next[c.id])) {
          next[c.id] = 1;
          changed = true;
        }
      }
      if (changed) {
        debug("[NOTIF] seeded unreadByConversationId for hasUnreadMessages conversations");
        return next;
      }
      return prev;
    });
  }, [conversations]);

  // Background poll for new conversations — only as a safety net.
  // When socket is connected, poll very infrequently (60s).
  // When socket is disconnected, the fallback-polling effect above handles it.
  useEffect(() => {
    if (authLoading || !user) return;
    if (!socketStatus.startsWith("connected")) return; // fallback effect handles disconnected state
    const interval = setInterval(() => { fetchConversations(); }, 60_000);
    return () => clearInterval(interval);
  }, [authLoading, user, socketStatus, fetchConversations]);

  useEffect(() => {
    if (!authLoading && user) fetchViewCounts();
  }, [authLoading, user, fetchViewCounts]);

  // Detail + notes
  const fetchConversationDetail = useCallback(async (id: string) => {
    // Cancel any in-flight detail fetch to prevent race conditions
    fetchDetailAbortRef.current?.abort();
    const controller = new AbortController();
    fetchDetailAbortRef.current = controller;
    try {
      setIsLoadingDetail(true);
      const res = await portalApiFetch(`/portal/conversations/${id}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error();
      const detail = await res.json();
      if (controller.signal.aborted) return;
      setConversationDetail((prev) => mergeConversationDetail(prev, detail));
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
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
    debug("[INBOX] selecting conversation:", id);
    setSelectedConversationId(id);
    setConversations(prev => sortConversations(prev.map(c => c.id === id ? { ...c, hasUnreadMessages: false } : c)));
    debug("[INBOX] calling markConversationRead for:", id);
    markConversationRead(id);
    setMobileView("chat");
    setIsLoadingDetail(true);

    // Mark as "opened" globally (used to suppress sound repeat).
    try {
      window.dispatchEvent(new CustomEvent("portal-inbox-conversation-opened", { detail: { conversationId: id } }));
      debug("[NOTIF] conversation opened:", id);
    } catch { /* */ }

    // Clear local unread count + flash state for this conversation, and decrement global unread.
    setUnreadByConversationId((prev) => {
      const current = Number(prev[id] ?? 0) || 0;
      if (current > 0) {
        try {
          window.dispatchEvent(new CustomEvent("portal-inbox-unread-decrement", { detail: { count: current } }));
        } catch { /* */ }
      }
      const next = { ...prev };
      delete next[id];
      debug("[NOTIF] unreadByConversationId cleared:", id, "count:", current);
      return next;
    });
    setFlashUntilByConversationId((prev) => {
      const next = { ...prev };
      delete next[id];
      const t = flashTimeoutsRef.current[id];
      if (t) clearTimeout(t);
      delete flashTimeoutsRef.current[id];
      debug("[NOTIF] flashUntil cleared:", id);
      return next;
    });

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
  }, [router, fetchConversationDetail, fetchNotes, fetchConversations, refreshUnreadBadge, markConversationAsRead, markConversationRead]);

  const closePanel = useCallback(() => {
    setSelectedConversationId(null); setConversationDetail(null); setNotes([]); setMobileView("list");
    try {
      window.dispatchEvent(new CustomEvent("portal-inbox-conversation-opened", { detail: { conversationId: null } }));
      debug("[NOTIF] conversation opened: null");
    } catch { /* */ }
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

  // Fallback polling when Socket.IO is not connected (gentle, 30s+ interval)
  useEffect(() => {
    if (socketStatus.startsWith("connected")) return;
    let cancelled = false;
    let delay = 30_000; // start at 30s, back off to max 60s
    const maxDelay = 60_000;
    const tick = () => {
      if (cancelled) return;
      fetchConversations();
      if (selectedConversationId) {
        fetchConversationDetail(selectedConversationId);
      }
      try {
        window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
      } catch { /* */ }
      delay = Math.min(delay * 1.3, maxDelay);
      timer = setTimeout(tick, delay);
    };
    let timer = setTimeout(tick, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [socketStatus, selectedConversationId, fetchConversations, fetchConversationDetail]);

  // If a new message arrives:
  // - active convo: mark read immediately + refetch detail
  // - other convo: mark unread so badge shows
  // Uses ref for selectedConversationId to avoid stale closure
  useEffect(() => {
    const onMessageNew = (event: Event) => {
      const detail = (event as CustomEvent<{
        conversationId?: string;
        content?: string;
        role?: string;
        message?: Message;
      }>).detail;
      const conversationId = detail?.conversationId;
      if (!conversationId) return;
      const role = detail?.role || "assistant";
      const isVisitorMessage = role === "user";

      const nowIso = new Date().toISOString();
      const previewText = cleanPreviewText(detail?.content || "");
      const currentSelectedId = selectedConversationIdRef.current;

      if (conversationId === currentSelectedId) {
        setConversations(prev => sortConversations(prev.map(c => c.id === conversationId
          ? {
              ...c,
              hasUnreadMessages: false,
              messageCount: c.messageCount + 1,
              updatedAt: nowIso,
              preview: c.preview
                ? { ...c.preview, text: previewText }
                : { text: previewText, from: role },
            }
          : c
        )));

        // Active chat: ensure local unread indicators are cleared and do NOT flash.
        setUnreadByConversationId((prev) => {
          if (!(conversationId in prev)) return prev;
          const next = { ...prev };
          delete next[conversationId];
          debug("[NOTIF] cleared unreadByConversationId (active chat):", conversationId);
          return next;
        });
        setFlashUntilByConversationId((prev) => {
          if (!(conversationId in prev)) return prev;
          const next = { ...prev };
          delete next[conversationId];
          const t = flashTimeoutsRef.current[conversationId];
          if (t) clearTimeout(t);
          delete flashTimeoutsRef.current[conversationId];
          debug("[NOTIF] cleared flashUntil (active chat):", conversationId);
          return next;
        });

        // INSTANT MESSAGE PUSH: inject the message directly into conversationDetail
        // so the chat pane updates immediately without waiting for an HTTP round-trip.
        if (detail.message) {
          const newMsg = detail.message;
          setConversationDetail(prev => {
            if (!prev || prev.id !== conversationId) return prev;
            const existingIds = new Set((prev.messages || []).map(m => m.id));
            if (existingIds.has(newMsg.id)) return prev;
            return {
              ...prev,
              messageCount: (prev.messageCount || 0) + 1,
              updatedAt: nowIso,
              messages: [...(prev.messages || []), newMsg],
            };
          });
        }

        // Active chat: force auto-scroll to bottom.
        try {
          shouldAutoScrollRef.current = true;
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          });
        } catch { /* */ }

        // Background fetch: get canonical data (attachments, formatting, etc.)
        fetchConversationDetail(conversationId).then(() => {
          try {
            window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
          } catch { /* */ }
        });
        return;
      }

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx === -1) return prev;
        const c = prev[idx]!;
        const bumped: ConversationListItem = {
          ...c,
          // IMPORTANT: keep this field for ordering logic; unreadMap drives the badge UI.
          hasUnreadMessages: isVisitorMessage ? true : c.hasUnreadMessages,
          messageCount: c.messageCount + 1,
          updatedAt: nowIso,
          preview: c.preview ? { ...c.preview, text: previewText } : { text: previewText, from: role },
        };
        // Deterministic: always move latest activity to top.
        const rest = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        return [bumped, ...rest];
      });

      if (isVisitorMessage) {
        // Increment local unread per conversation
        setUnreadByConversationId((prev) => {
          const current = Number(prev[conversationId] ?? 0) || 0;
          const nextCount = current + 1;
          debug("[NOTIF] unreadByConversationId++:", conversationId, current, "->", nextCount);
          return { ...prev, [conversationId]: nextCount };
        });

        // Flash for up to 60s (reset on each new message)
        setFlashUntilByConversationId((prev) => {
          const until = Date.now() + 60_000;
          debug("[NOTIF] flashUntil set:", conversationId, "->", new Date(until).toISOString());
          const next = { ...prev, [conversationId]: until };
          const existing = flashTimeoutsRef.current[conversationId];
          if (existing) clearTimeout(existing);
          flashTimeoutsRef.current[conversationId] = setTimeout(() => {
            setFlashUntilByConversationId((p) => {
              if (!(conversationId in p)) return p;
              const n = { ...p };
              delete n[conversationId];
              debug("[NOTIF] flashUntil auto-cleared:", conversationId);
              return n;
            });
          }, 60_000);
          return next;
        });
      }

      fetchConversations();
    };
    window.addEventListener("portal-inbox-message-new", onMessageNew as EventListener);
    return () => window.removeEventListener("portal-inbox-message-new", onMessageNew as EventListener);
  }, [fetchConversationDetail, fetchConversations]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    shouldAutoScrollRef.current = distanceFromBottom < 120;
  }, []);

  useEffect(() => {
    const el = messagesContainerRef.current;
    const msgs = conversationDetail?.messages || [];
    if (!el || msgs.length === 0) return;

    const lastId = msgs[msgs.length - 1]?.id || null;
    const isFirstLoadForThisThread = lastMessageIdRef.current === null;
    const didChange = Boolean(lastId && lastMessageIdRef.current && lastId !== lastMessageIdRef.current);
    lastMessageIdRef.current = lastId;

    // Only auto-scroll if user is already near the bottom. Otherwise preserve scroll position.
    if (!didChange && !isFirstLoadForThisThread) return;
    if (!shouldAutoScrollRef.current) return;

    // Use rAF to wait for DOM paint.
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    });
  }, [conversationDetail?.id, conversationDetail?.messages]);

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
    if (!canUseTakeover) {
      openUpgradeForPlan("starter");
      return;
    }
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

  const handleTakeOverFromAi = async () => {
    if (!user?.id || isUpdating) return;
    await handleAssignmentChange(user.id);
  };

  const handleAddNote = async () => {
    if (!canUseInternalNotes) {
      openUpgradeForPlan("starter");
      return;
    }
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
    if (!selectedConversationId || !conversationDetail || (!replyBody.trim() && !selectedFileName) || isSendingReply) return;
    setIsSendingReply(true);
    try {
      const cleanedReply = sanitizePlainText(replyBody).trim();
      const messagePayload = selectedFileName
        ? `📎 ${selectedFileName}${cleanedReply ? `\n${cleanedReply}` : ""}`
        : cleanedReply;
      if (!cleanedReply) {
        if (!selectedFileName) {
          showToast(t("common.error"));
          return;
        }
      }
      if (selectedFileName && !canUseFileUpload) {
        openUpgradeForPlan("starter");
        return;
      }
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: messagePayload }),
      });
      if (res.ok) {
        const d = await res.json();
        const newMsg = {
          id: d.id,
          conversationId: selectedConversationId,
          role: "assistant" as const,
          content: sanitizeConversationMsg({ content: d.content || "" }).content,
          timestamp: d.timestamp,
        };
        setConversationDetail(prev => {
          if (!prev) return prev;
          return { ...prev, messages: [...prev.messages, newMsg] };
        });
        setReplyBody("");
        setSelectedFileName(null);
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

  const handleSendAiSuggestion = useCallback(async () => {
    if (!selectedConversationId || !conversationDetail || !aiSuggestion.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: aiSuggestion.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        const newMsg = {
          id: d.id,
          conversationId: selectedConversationId,
          role: "assistant" as const,
          content: sanitizeConversationMsg({ content: d.content || "" }).content,
          timestamp: d.timestamp,
        };
        setConversationDetail(prev => {
          if (!prev) return prev;
          return { ...prev, messages: [...prev.messages, newMsg] };
        });
        setReplyBody("");
        setShowAiSuggestionPanel(false);
        setAiSuggestion("");
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
  }, [selectedConversationId, conversationDetail, aiSuggestion, isSendingReply, showToast, t]);

  const handleComposerSend = useCallback(async () => {
    if (noteMode) {
      if (!canUseInternalNotes) {
        openUpgradeForPlan("starter");
        return;
      }
      if (!selectedConversationId || !replyBody.trim()) return;
      const noteText = sanitizePlainText(replyBody).trim();
      if (!noteText) return;
      setIsSendingReply(true);
      try {
        const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/notes`, {
          method: "POST",
          body: JSON.stringify({ body: noteText }),
        });
        if (res.ok) {
          const d = await res.json();
          setNotes((prev) => [d.note, ...prev]);
          setConversationDetail((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  id: `note-${d.note?.id || Date.now()}`,
                  conversationId: selectedConversationId,
                  role: "assistant",
                  content: `[note] ${noteText}`,
                  timestamp: d.note?.createdAt || new Date().toISOString(),
                },
              ],
            };
          });
          setReplyBody("");
          setNoteMode(false);
          showToast(t("inbox.noteSubmit"));
          return;
        }
      } catch {
        showToast(t("common.error"));
      } finally {
        setIsSendingReply(false);
      }
      return;
    }
    await handleSendReply();
  }, [noteMode, canUseInternalNotes, openUpgradeForPlan, selectedConversationId, replyBody, showToast, t, handleSendReply]);

  const handleSendNote = useCallback(async (rawText: string) => {
    if (!canUseInternalNotes) {
      openUpgradeForPlan("starter");
      return;
    }
    if (!selectedConversationId) return;
    const noteText = sanitizePlainText(rawText).trim();
    if (!noteText) return;
    setIsSendingReply(true);
    try {
      const res = await portalApiFetch(`/portal/conversations/${selectedConversationId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: noteText }),
      });
      if (res.ok) {
        const d = await res.json();
        setNotes((prev) => [d.note, ...prev]);
        setConversations((prev) => prev.map((c) => c.id === selectedConversationId ? { ...c, noteCount: c.noteCount + 1 } : c));
        setConversationDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: `note-${d.note?.id || Date.now()}`,
                conversationId: selectedConversationId,
                role: "assistant",
                content: `[note] ${noteText}`,
                timestamp: d.note?.createdAt || new Date().toISOString(),
              },
            ],
          };
        });
        showToast(t("inbox.noteSubmit"));
      } else {
        showToast(t("common.error"));
      }
    } catch {
      showToast(t("common.error"));
    } finally {
      setIsSendingReply(false);
    }
  }, [canUseInternalNotes, openUpgradeForPlan, selectedConversationId, showToast, t]);

  // Derived
  const selectedConv = conversations.find(c => c.id === selectedConversationId);
  const currentStatus = conversationDetail?.status || "OPEN";
  const isOpen = currentStatus === "OPEN";
  const isOnline = isOpen;
  const hasAiMessagesInThread = Boolean(
    conversationDetail?.messages?.some((m) => m.role === "assistant" && m.isAIGenerated)
  );
  const showTakeoverCta = Boolean(
    selectedConversationId &&
    user?.id &&
    isOpen &&
    canUseTakeover &&
    hasAiMessagesInThread &&
    !conversationDetail?.assignedTo?.id
  );
  const selectedConvExtra = selectedConv as (ConversationListItem & {
    channel?: string;
    recipientId?: string;
    country?: string;
    browser?: string;
    currentPage?: string;
    timeOnSite?: string;
    visitCount?: number;
  }) | undefined;
  const selectedTags = selectedConversationId ? (conversationTags[selectedConversationId] || []) : [];

  const handleAddTag = useCallback(() => {
    if (!selectedConversationId) return;
    const nextTag = tagInput.trim();
    if (!nextTag) return;
    if (selectedTags.includes(nextTag)) return;
    if (selectedTags.length >= maxTagsForPlan) {
      openUpgradeForPlan("starter");
      return;
    }
    setConversationTags((prev) => ({
      ...prev,
      [selectedConversationId]: [...(prev[selectedConversationId] || []), nextTag],
    }));
    setTagInput("");
  }, [selectedConversationId, tagInput, selectedTags, maxTagsForPlan, openUpgradeForPlan]);

  const handleRemoveTag = useCallback((tag: string) => {
    if (!selectedConversationId) return;
    setConversationTags((prev) => ({
      ...prev,
      [selectedConversationId]: (prev[selectedConversationId] || []).filter((item) => item !== tag),
    }));
  }, [selectedConversationId]);

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
    <div className="portal-inbox-root fixed inset-0 top-16 lg:left-[260px] flex overflow-hidden bg-[#FFFBF5] z-10">

      {/* ═══ PANEL 1: LEFT SIDEBAR ═══ */}
      <div className={`w-full sm:w-[320px] lg:w-[340px] flex-shrink-0 border-r flex flex-col bg-white ${mobileView !== "list" ? "hidden sm:flex" : "flex"}`} style={{ borderColor: WARM_BORDER }}>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="relative group">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t("inbox.sidebar.search")}
              className="w-full pl-10 pr-[14px] py-[10px] font-[var(--font-body)] text-[14px] border border-amber-200/70 rounded-xl bg-[#FFFBF5] placeholder:text-slate-400 focus:outline-none focus:border-[#FDB462] focus:ring-4 focus:ring-amber-100 focus:bg-white transition-all shadow-sm" />
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
              className={`flex-1 flex items-center justify-center gap-1.5 px-[6px] py-[8px] rounded-lg font-[var(--font-body)] text-[13px] font-semibold transition-all duration-200 ${
                statusFilter === "OPEN" && assignedFilter === "unassigned" ? "bg-white text-amber-800 shadow-sm ring-1 ring-amber-200" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}>
              {t("inbox.filterUnassigned")}
              {viewCounts.unassigned > 0 && (
                <span className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
                  statusFilter === "OPEN" && assignedFilter === "unassigned" ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30" : "bg-slate-200/80 text-slate-600"
                }`}>{viewCounts.unassigned > 99 ? "99+" : viewCounts.unassigned}</span>
              )}
            </button>
            <button onClick={() => { setStatusFilter("OPEN"); setAssignedFilter("me"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-[6px] py-[8px] rounded-lg font-[var(--font-body)] text-[13px] font-semibold transition-all duration-200 ${
                statusFilter === "OPEN" && assignedFilter === "me" ? "bg-white text-sky-700 shadow-sm ring-1 ring-sky-200" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}>
              {t("inbox.filterMyOpen")}
              {viewCounts.myOpen > 0 && (
                <span className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
                  statusFilter === "OPEN" && assignedFilter === "me" ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30" : "bg-slate-200/80 text-slate-600"
                }`}>{viewCounts.myOpen}</span>
              )}
            </button>
            <button onClick={() => { setStatusFilter("CLOSED"); setAssignedFilter("any"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-[6px] py-[8px] rounded-lg font-[var(--font-body)] text-[13px] font-semibold transition-all duration-200 ${
                statusFilter === "CLOSED" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}>
              {t("inbox.filterSolved")}
              {viewCounts.solved > 0 && (
                <span className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
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
                    if (locked) { openUpgradeForPlan("pro", `smartFilter.${f.key}`); return; }
                    setSmartFilter(active ? null : f.key);
                  }}
                  title={t(tooltipKey as TranslationKey)}
                  className={`inline-flex items-center gap-1.5 px-[12px] py-[5px] text-[12px] font-semibold border rounded-lg transition-all ${
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
                onClick={() => { openUpgradeForPlan("pro", "bulkActions"); }}
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
            <div className="px-3 py-3">
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="mx-2 my-1 rounded-xl border border-slate-100 bg-white px-[14px] py-[13px] shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-9 w-9 rounded-xl bg-slate-100 animate-pulse" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="h-3.5 w-32 rounded bg-slate-100 animate-pulse" />
                          <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
                        </div>
                        <div className="mt-2 h-3 w-56 rounded bg-slate-100 animate-pulse" />
                        <div className="mt-2 flex gap-2">
                          <div className="h-5 w-14 rounded-md bg-slate-100 animate-pulse" />
                          <div className="h-5 w-20 rounded-md bg-slate-100 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
            // Frontend-driven unread state (API doesn't return reliable hasUnreadMessages)
            const unreadFromMap = unreadMap[conv.id] || 0;
            const hasUnread = unreadFromMap > 0;
            return (
              <div key={conv.id} data-conversation-id={conv.id} onClick={() => selectConversation(conv.id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectConversation(conv.id); } }}
                className={`group relative mx-2 my-1 cursor-pointer rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                  active
                    ? "ring-1 ring-blue-200/60 shadow-sm"
                    : "hover:bg-slate-50/60"
                }`}
                style={{
                  padding: "13px 14px",
                  background: active ? "rgba(219,234,254,0.8)" : hasUnread ? "rgba(239,68,68,0.06)" : undefined,
                  fontWeight: hasUnread ? 600 : undefined,
                  borderLeft: hasUnread && !active ? "3px solid #EF4444" : active ? "3px solid #3B82F6" : "3px solid transparent",
                }}>

                <div className="flex items-start gap-3">
                  {/* Unread red dot */}
                  {hasUnread && !active && (
                    <span className="mt-[6px] h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                  )}

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
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shadow-sm ${getAvatarColor(conv.id)}`}>
                      {getInitials(name)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-[14px] truncate ${hasUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>{name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[12px] text-slate-400 tabular-nums font-medium" suppressHydrationWarning>{hydrated ? formatRelativeTime(conv.updatedAt, t) : formatTime(conv.updatedAt, hydrated)}</span>
                        {/* Unread count badge */}
                        {unreadFromMap > 0 && (
                          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                            {unreadFromMap > 99 ? "99+" : unreadFromMap}
                          </span>
                        )}
                      </div>
                    </div>
                    {conv.preview && <p className={`text-[13px] leading-snug truncate mb-1.5 ${hasUnread ? "text-slate-700 font-medium" : "text-slate-500"}`}>{cleanPreviewText(conv.preview.text)}</p>}
                    <div className="flex items-center gap-1.5">
                      {conv.slaStatus && (
                        <span
                          className={`inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-md font-semibold ${
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
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded-md font-medium">
                          <User size={9} className="text-slate-400" />{conv.assignedTo.email.split("@")[0]}
                        </span>
                      )}
                      {conv.status === "CLOSED" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle size={9} />{t("inbox.statusClosed")}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-300 tabular-nums font-medium">{conv.messageCount} {t("common.abbrev.messages")}</span>
                    </div>
                  </div>
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
      <ErrorBoundary>
      <div className={`flex-1 flex flex-col min-w-0 ${mobileView !== "chat" && mobileView !== "list" ? "hidden sm:flex" : mobileView === "list" ? "hidden sm:flex" : "flex"}`}>
        {!selectedConversationId ? (
          /* ── Design 1: Bold stats + clean list card ── */
          <div className="flex-1 overflow-y-auto bg-[#FFFBF5] px-6 py-6">
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
                  style={{ background: inboxSimulateButtonGradient }}
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
            <div className="bg-white px-5 py-3" style={{ borderBottom: `1px solid ${WARM_BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button onClick={closePanel} className="sm:hidden text-slate-500 hover:text-slate-700"><ArrowLeft size={18} /></button>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "11px",
                      background: isOpen ? "linear-gradient(135deg,#22C55E,#16A34A)" : "#E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 700, color: isOpen ? "#fff" : "#94A3B8" }}>Z#</span>
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#1A1D23" }}>
                      {selectedConv ? displayName(selectedConv, t) : ""}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: isOpen ? "#22C55E" : "#94A3B8" }} />
                      <span style={{ fontSize: "13px", color: "#94A3B8" }}>
                        {isOpen ? t("inbox.online" as TranslationKey) : t("inbox.offline" as TranslationKey)} · {conversationDetail?.messages?.length || 0} {t("inbox.messages" as TranslationKey)}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    onClick={() => { if (!canUseAiSuggest) { openUpgradeForPlan("pro", "aiSuggestion"); return; } handleAiSuggest(); }}
                    title={t("inbox.ai.suggestReplyTooltip")}
                    style={{ width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #F3E8D8", background: "#fff", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", opacity: canUseAiSuggest ? 1 : 0.45, position: "relative" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFBF5"; e.currentTarget.style.borderColor = "#F59E0B"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#F3E8D8"; }}
                  >
                    🤖
                    {!canUseAiSuggest && <span style={{ position: "absolute", right: -2, top: -3, fontSize: 9 }}>🔒</span>}
                  </button>
                  <button
                    onClick={() => setShowCannedPicker((prev) => !prev)}
                    title={t("inbox.canned.toggle" as TranslationKey)}
                    style={{ width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #F3E8D8", background: "#fff", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFBF5"; e.currentTarget.style.borderColor = "#F59E0B"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#F3E8D8"; }}
                  >
                    📋
                  </button>
                  <button
                    onClick={() => { if (!canUseInternalNotes) { openUpgradeForPlan("starter", "internalNotes"); return; } setNoteMode(true); }}
                    title={t("inbox.notes.title")}
                    style={{ width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #F3E8D8", background: noteMode ? "#FEF3C7" : "#fff", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", opacity: canUseInternalNotes ? 1 : 0.45, position: "relative" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFBF5"; e.currentTarget.style.borderColor = "#F59E0B"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = noteMode ? "#FEF3C7" : "#fff"; e.currentTarget.style.borderColor = "#F3E8D8"; }}
                  >
                    📝
                    {!canUseInternalNotes && <span style={{ position: "absolute", right: -2, top: -3, fontSize: 9 }}>🔒</span>}
                  </button>
                  <button
                    onClick={() => setShowTagBar((prev) => !prev)}
                    title={t("inbox.tags.manage" as TranslationKey)}
                    style={{ width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #F3E8D8", background: "#fff", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFBF5"; e.currentTarget.style.borderColor = "#F59E0B"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#F3E8D8"; }}
                  >
                    🏷️
                  </button>

                  <div style={{ width: "1px", height: "20px", background: "#F3E8D8", margin: "0 1px" }} />

                  <select
                    value={conversationDetail?.assignedTo?.id || ""}
                    onChange={(e) => handleAssignmentChange(e.target.value || null)}
                    disabled={isUpdating || !canUseTakeover}
                    style={{ height: "40px", borderRadius: "8px", border: "1px solid #F3E8D8", background: "#fff", fontSize: "13px", fontWeight: 600, color: "#64748B", padding: "0 12px", opacity: canUseTakeover ? 1 : 0.45 }}
                  >
                    <option value="">👤 {t("inbox.chat.assign")}</option>
                    {teamMembers.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.email.split("@")[0]}</option>)}
                  </select>

                  {showTakeoverCta && (
                    <button
                      onClick={handleTakeOverFromAi}
                      disabled={isUpdating}
                      style={{
                        padding: "7px 12px",
                        borderRadius: "10px",
                        border: "1px solid #BFDBFE",
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: isUpdating ? "not-allowed" : "pointer",
                        opacity: isUpdating ? 0.6 : 1,
                      }}
                      title="AI yanitlarini durdur ve bu sohbeti devral"
                    >
                      🤝 AI'dan Devral
                    </button>
                  )}

                  <button
                    onClick={() => handleStatusChange(isOpen ? "CLOSED" : "OPEN")}
                    style={{
                      padding: "7px 16px",
                      borderRadius: "10px",
                      background: isOpen ? "linear-gradient(135deg,#22C55E,#16A34A)" : "#E2E8F0",
                      color: isOpen ? "#fff" : "#94A3B8",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: isOpen ? "pointer" : "default",
                    }}
                  >
                    {isOpen ? t("inbox.close" as TranslationKey) : t("inbox.resolved" as TranslationKey)}
                  </button>

                  <button
                    onClick={() => setShowRightPanel(!showRightPanel)}
                    title={showRightPanel ? t("inbox.detail.closePanel") : t("inbox.detail.details")}
                    style={{ width: "40px", height: "40px", borderRadius: "10px", border: "1px solid #F3E8D8", background: showRightPanel ? "#FFFBF5" : "#fff", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFBF5"; e.currentTarget.style.borderColor = "#F59E0B"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = showRightPanel ? "#FFFBF5" : "#fff"; e.currentTarget.style.borderColor = "#F3E8D8"; }}
                  >
                    ℹ️
                  </button>
                </div>
              </div>
            </div>

            {showTagBar && (
              <div className="mx-5 mt-3 rounded-xl border bg-[#FFFBF5] px-3 py-2" style={{ borderColor: WARM_BORDER }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-slate-600">{t("inbox.tags.manage" as TranslationKey)}</span>
                  <span className="text-[11px] text-slate-400">
                    {Number.isFinite(maxTagsForPlan) ? `${selectedTags.length}/${maxTagsForPlan}` : t("inbox.tags.unlimited" as TranslationKey)}
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selectedTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-[8px] py-[3px] text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="text-amber-700 hover:text-amber-900">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder={t("inbox.tags.placeholder" as TranslationKey)}
                    className="h-8 flex-1 rounded-lg border border-amber-100 bg-white px-2.5 text-[13px] outline-none focus:border-amber-300"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="h-8 rounded-lg bg-gradient-to-r from-[#F59E0B] to-[#D97706] px-3 text-[13px] font-semibold text-white"
                  >
                    {t("common.add")}
                  </button>
                </div>
              </div>
            )}

            {showCannedPicker && (
              <div className="mx-5 mt-3 rounded-xl border bg-white p-3" style={{ borderColor: WARM_BORDER }}>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {(["greeting", "pricing", "technical", "closing"] as const).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCannedCategory(category)}
                    className={`rounded-lg px-[14px] py-[7px] text-[13px] font-semibold ${
                        selectedCannedCategory === category
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      {t(`inbox.canned.category.${category}` as TranslationKey)}
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  {CANNED_RESPONSES[selectedCannedCategory].map((key, idx) => (
                    <button
                      key={`${selectedCannedCategory}-${idx}`}
                      type="button"
                      onClick={() => {
                        setReplyBody(t(key as TranslationKey));
                        setShowCannedPicker(false);
                      }}
                      className="block w-full rounded-lg px-[12px] py-[9px] text-left text-[14px] text-slate-700 hover:bg-[#FFFBF5]"
                    >
                      {t(key as TranslationKey)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detailTab === "notes" && canUseInternalNotes && (
              <div className="mx-5 mt-3 rounded-xl border border-dashed bg-[#FEF3C7] px-3 py-2 text-[11px] font-semibold text-[#92400E]" style={{ borderColor: "#FCD34D" }}>
                📝 {t("inbox.notes.mode" as TranslationKey)}
              </div>
            )}

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
                    <span className="text-[14px] font-bold text-violet-800">{t("inbox.ai.sentimentTitle")}</span>
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
                <p className="text-[15px] text-slate-600 leading-relaxed">{aiSentiment.summary}</p>
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
                    <span className="text-[14px] font-bold text-purple-800">{t("inbox.ai.summaryTitle")}</span>
                  </div>
                  <button onClick={() => setAiSummary(null)} className="p-1 text-purple-400 hover:text-purple-600 rounded transition-colors"><X size={14} /></button>
                </div>
                <p className="text-[15px] text-slate-700 leading-relaxed">{aiSummary}</p>
              </div>
            )}

            {/* ── AI Suggestion Panel ── */}
            {showAiSuggestionPanel && (
              <div
                style={{
                  margin: "0 16px 8px",
                  padding: "14px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #EFF6FF, #F0F7FF)",
                  border: "1px solid #BFDBFE",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "16px" }}>🤖</span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#1E3A5F" }}>
                      {t("inbox.ai.suggestionTitle" as TranslationKey)}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAiSuggestionPanel(false)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: "#94A3B8",
                      padding: "2px",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {aiSuggestionLoading ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 0",
                      color: "#3B82F6",
                      fontSize: "13px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "14px",
                        height: "14px",
                        border: "2px solid #BFDBFE",
                        borderTopColor: "#3B82F6",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    {t("inbox.ai.generating" as TranslationKey)}
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#1E3A5F",
                      lineHeight: 1.6,
                      margin: "0 0 12px",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {aiSuggestion}
                  </p>
                )}

                {!aiSuggestionLoading && aiSuggestion && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      onClick={handleSendAiSuggestion}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "9px",
                        background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                        color: "#fff",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(59,130,246,0.2)",
                      }}
                    >
                      ✓ {t("inbox.ai.send" as TranslationKey)}
                    </button>

                    <button
                      onClick={() => {
                        setReplyBody(aiSuggestion);
                        setShowAiSuggestionPanel(false);
                        setAiSuggestion("");
                        setTimeout(() => {
                          inputRef.current?.focus();
                        }, 100);
                      }}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "9px",
                        background: "#fff",
                        color: "#1E3A5F",
                        border: "1px solid #BFDBFE",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ✏️ {t("inbox.ai.edit" as TranslationKey)}
                    </button>

                    <button
                      onClick={() => {
                        setShowAiSuggestionPanel(false);
                        setAiSuggestion("");
                      }}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "9px",
                        background: "#fff",
                        color: "#94A3B8",
                        border: "1px solid #E2E8F0",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ✕ {t("inbox.ai.reject" as TranslationKey)}
                    </button>

                    <button
                      onClick={fetchAiSuggestion}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "9px",
                        background: "#fff",
                        color: "#3B82F6",
                        border: "1px solid #BFDBFE",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      🔄 {t("inbox.ai.regenerate" as TranslationKey)}
                    </button>
                  </div>
                )}
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
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto px-5 py-5 space-y-3 bg-[#FFFBF5]"
            >
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-12"><div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" /></div>
              ) : conversationDetail?.messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2"><MessageSquare size={16} className="text-slate-400" /></div>
                  <p className="text-sm text-slate-400">{t("inbox.chat.noMessages")}</p>
                </div>
              ) : conversationDetail?.messages.map((msg) => {
                const senderType: "visitor" | "agent" | "ai" | "system" | "note" =
                  msg.role === "user"
                    ? "visitor"
                    : /^\[system\]/i.test(msg.content)
                      ? "system"
                      : /^\[note\]/i.test(msg.content)
                        ? "note"
                        : (msg.isAIGenerated || Boolean(msg.aiProvider))
                          ? "ai"
                          : "agent";
                const message = {
                  senderType,
                  senderName:
                    senderType === "visitor"
                      ? (selectedConv ? displayName(selectedConv, t) : t("dashboard.liveVisitors.visitor"))
                      : senderType === "ai"
                        ? "AI Assistant"
                        : user?.email?.split("@")[0] || "Agent",
                  content: senderType === "system"
                    ? translateSystemMessage(msg.content, t)
                    : msg.content.replace(/^\[(system|note)\]\s*/i, ""),
                  time: formatTime(msg.timestamp, hydrated),
                };

                switch (message.senderType) {
                  case "visitor":
                    return (
                      <div key={msg.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "12px",
                            background: "#E2E8F0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748B" }}>Z</span>
                        </div>
                        <div style={{ maxWidth: "75%" }}>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#94A3B8",
                              marginBottom: "3px",
                              display: "block",
                            }}
                          >
                            {message.senderName}
                          </span>
                          <div style={{ padding: "12px 18px", borderRadius: "16px 16px 16px 4px", background: "#F1F5F9" }}>
                            <p style={{ fontSize: "15px", margin: 0, lineHeight: 1.6, color: "#1A1D23", whiteSpace: "pre-wrap" }}>
                              {message.content}
                            </p>
                          </div>
                          <span style={{ fontSize: "12px", color: "#CBD5E1", marginTop: "3px", display: "block" }}>
                            {message.time}
                          </span>
                        </div>
                      </div>
                    );
                  case "agent":
                    return (
                      <div key={msg.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", flexDirection: "row-reverse" }}>
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "12px",
                            background: "linear-gradient(135deg, #F59E0B, #D97706)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>{message.senderName?.[0] || "A"}</span>
                        </div>
                        <div style={{ maxWidth: "75%", textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#94A3B8",
                              marginBottom: "3px",
                              display: "block",
                            }}
                          >
                            {message.senderName}
                          </span>
                          <div
                            style={{
                              padding: "12px 18px",
                              borderRadius: "16px 16px 4px 16px",
                              background: "linear-gradient(135deg, #F59E0B, #D97706)",
                              boxShadow: "0 2px 8px rgba(245,158,11,0.15)",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "15px",
                                margin: 0,
                                lineHeight: 1.6,
                                color: "#fff",
                                whiteSpace: "pre-wrap",
                                textAlign: "left",
                              }}
                            >
                              {message.content}
                            </p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end", marginTop: "3px" }}>
                            <span style={{ fontSize: "12px", color: "#CBD5E1" }}>{message.time}</span>
                            <span style={{ fontSize: "12px", color: "#94A3B8" }}>✓✓</span>
                          </div>
                        </div>
                      </div>
                    );
                  case "ai":
                    return (
                      <div key={msg.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", flexDirection: "row-reverse" }}>
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "12px",
                            background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                          </svg>
                        </div>
                        <div style={{ maxWidth: "75%", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end", marginBottom: "3px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#94A3B8" }}>{message.senderName}</span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "#3B82F6",
                                background: "#EFF6FF",
                                padding: "3px 9px",
                                borderRadius: "10px",
                                border: "1px solid #BFDBFE",
                              }}
                            >
                              🤖 AI
                            </span>
                          </div>
                          <div
                            style={{
                              padding: "12px 18px",
                              borderRadius: "16px 16px 4px 16px",
                              background: "#EFF6FF",
                              border: "1px solid #BFDBFE",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "15px",
                                margin: 0,
                                lineHeight: 1.6,
                                color: "#1E3A5F",
                                whiteSpace: "pre-wrap",
                                textAlign: "left",
                              }}
                            >
                              {message.content}
                            </p>
                          </div>
                          <span style={{ fontSize: "12px", color: "#CBD5E1", marginTop: "3px", display: "block" }}>{message.time}</span>
                        </div>
                      </div>
                    );
                  case "system":
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: "center", margin: "2px 0" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 14px",
                            borderRadius: "20px",
                            background: "rgba(148,163,184,0.08)",
                            border: "1px solid rgba(148,163,184,0.1)",
                          }}
                        >
                          <span style={{ fontSize: "14px", color: "#94A3B8", fontStyle: "italic" }}>{message.content}</span>
                          <span style={{ fontSize: "12px", color: "#CBD5E1" }}>{message.time}</span>
                        </div>
                      </div>
                    );
                  case "note":
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: "center", margin: "2px 0" }}>
                        <div
                          style={{
                            maxWidth: "85%",
                            padding: "10px 14px",
                            borderRadius: "12px",
                            background: "#FEF3C7",
                            border: "1px dashed #FCD34D",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#92400E" }}>
                              📝 {t("inbox.internalNote" as TranslationKey)} — {message.senderName}
                            </span>
                            <span style={{ fontSize: "12px", color: "#B45309" }}>{message.time}</span>
                          </div>
                          <p style={{ fontSize: "14px", color: "#78350F", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
                            {message.content}
                          </p>
                          <div style={{ fontSize: "11px", color: "#D97706", marginTop: "3px" }}>
                            👁 {t("inbox.teamOnly" as TranslationKey)}
                          </div>
                        </div>
                      </div>
                    );
                  default:
                    return null;
                }
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Quick Replies ── */}
            <div className="bg-white px-5 pt-2" style={{ borderTop: `1px solid ${WARM_BORDER}` }}>
              <div style={{ display: "flex", gap: "4px", marginBottom: "5px", flexWrap: "wrap" }}>
              {[
                t("inbox.quickReply1" as TranslationKey),
                t("inbox.quickReply2" as TranslationKey),
                t("inbox.quickReply3" as TranslationKey),
              ].map((qr) => (
                <button
                  key={qr}
                  type="button"
                  onClick={() => {
                    setReplyBody(qr);
                    inputRef.current?.focus();
                  }}
                  style={{ padding: "5px 13px", borderRadius: "18px", fontSize: "12px", fontWeight: 500, background: "#FAFAFA", border: "1px solid #F3E8D8", color: "#64748B", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF3C7"; e.currentTarget.style.borderColor = "#FCD34D"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#FAFAFA"; e.currentTarget.style.borderColor = "#F3E8D8"; }}
                >
                  {qr}
                </button>
              ))}
              </div>
              {noteMode && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    marginBottom: "5px",
                    padding: "5px 12px",
                    borderRadius: "7px",
                    background: "#FEF3C7",
                    border: "1px solid #FCD34D",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#92400E" }}>
                    📝 {t("inbox.noteMode" as TranslationKey)} — {t("inbox.teamOnlyVisible" as TranslationKey)}
                  </span>
                  <button
                    onClick={() => setNoteMode(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#92400E", fontSize: "11px", marginLeft: "auto" }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {selectedFileName && (
              <div className="mx-5 mb-1 rounded-lg border border-[#FCD34D] bg-[#FEF3C7] px-3 py-1.5 text-[11px] text-[#92400E]">
                <div className="flex items-center justify-between">
                  <span>📎 {selectedFileName}</span>
                  <button type="button" onClick={() => setSelectedFileName(null)} className="text-[#92400E]">✕</button>
                </div>
              </div>
            )}

            {/* ── Composer ── */}
            <div className="bg-white px-5 pb-3.5" role="form" aria-label={t("inbox.chat.replyForm")}>
              {selectedFileName && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", marginBottom: "6px", borderRadius: "8px", background: "#FEF3C7", border: "1px solid #FCD34D", fontSize: "12px", color: "#92400E" }}>
                  <span>📎 {selectedFileName}</span>
                  <button onClick={() => setSelectedFileName(null)} style={{ background: "none", border: "none", color: "#92400E", cursor: "pointer", fontSize: "13px" }}>✕</button>
                </div>
              )}
              <div
                className="focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:ring-offset-2 focus-within:ring-offset-white transition-shadow"
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "7px",
                  padding: "9px 13px",
                  borderRadius: "14px",
                  border: noteMode ? "2px solid #FCD34D" : "1px solid #F3E8D8",
                  background: noteMode ? "#FFFEF5" : "#FAFAFA",
                }}
              >
                <textarea
                  ref={inputRef}
                  value={replyBody}
                  onChange={(e) => {
                    setReplyBody(e.target.value);
                    if (selectedConversationId) {
                      emitAgentTyping(selectedConversationId);
                      if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current);
                      agentTypingTimerRef.current = setTimeout(() => {
                        if (selectedConversationId) emitAgentTypingStop(selectedConversationId);
                      }, 1500);
                    }
                  }}
                  placeholder={noteMode ? t("inbox.notePlaceholder" as TranslationKey) : t("inbox.messagePlaceholder" as TranslationKey)}
                  rows={1}
                  style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: "15px", color: "#1A1D23", resize: "none", fontFamily: "inherit", lineHeight: 1.5, minHeight: "26px", maxHeight: "100px" }}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = "26px";
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleComposerSend();
                    }
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "1px" }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedFileName(file.name);
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!canUseFileAttach) { openUpgradeForPlan("starter", "fileAttach"); return; }
                      fileInputRef.current?.click();
                    }}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    style={{ width: "34px", height: "34px", borderRadius: "7px", border: "none", background: "transparent", cursor: "pointer", fontSize: "17px", display: "flex", alignItems: "center", justifyContent: "center", opacity: canUseFileAttach ? 1 : 0.45 }}
                    title={t("inbox.upload.tooltip" as TranslationKey)}
                  >
                    📎
                  </button>
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      style={{ width: "34px", height: "34px", borderRadius: "7px", border: "none", background: showEmojiPicker ? "#FEF3C7" : "transparent", cursor: "pointer", fontSize: "17px", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      😊
                    </button>
                    {showEmojiPicker && (
                      <div style={{ position: "absolute", bottom: "32px", right: 0, background: "#fff", border: "1px solid #F3E8D8", borderRadius: "13px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", padding: "10px", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "3px", width: "240px", zIndex: 50 }}>
                        {EMOJIS.map((em) => (
                          <button
                            key={em}
                            onClick={() => {
                              setReplyBody((prev) => prev + em);
                              setShowEmojiPicker(false);
                              inputRef.current?.focus();
                            }}
                            style={{ width: "36px", height: "36px", borderRadius: "6px", border: "none", background: "transparent", cursor: "pointer", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleComposerSend}
                    disabled={!replyBody.trim()}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "11px",
                      background: replyBody.trim() ? "linear-gradient(135deg, #F59E0B, #D97706)" : "#E2E8F0",
                      border: "none",
                      cursor: replyBody.trim() ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: replyBody.trim() ? "0 2px 8px rgba(245,158,11,0.25)" : "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={replyBody.trim() ? "#fff" : "#94A3B8"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      </ErrorBoundary>

      {/* ═══ PANEL 3: RIGHT — Customer Details + Notes ═══ */}
      <div className={`w-[320px] flex-shrink-0 bg-white border-l flex flex-col overflow-y-auto ${
        mobileView === "details"
          ? "flex fixed inset-0 z-50 w-full bg-white lg:static lg:w-[320px]"
          : showRightPanel ? "hidden lg:flex" : "hidden"
      }`} style={{ borderColor: WARM_BORDER }}>
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

            <div style={{ padding: "14px", textAlign: "center", borderBottom: `1px solid ${WARM_BORDER}` }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "15px",
                  background: isOnline ? "linear-gradient(135deg,#22C55E,#16A34A)" : "#E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 7px",
                }}
              >
                <span style={{ fontSize: "18px", fontWeight: 700, color: isOnline ? "#fff" : "#94A3B8" }}>Z#</span>
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#1A1D23" }}>
                {selectedConv ? displayName(selectedConv, t) : ""}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginTop: "3px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: isOnline ? "#22C55E" : "#94A3B8" }} />
                <span style={{ fontSize: "12px", color: isOnline ? "#22C55E" : "#94A3B8", fontWeight: 600 }}>
                  {isOpen ? (isOnline ? t("inbox.online" as TranslationKey) : t("inbox.offline" as TranslationKey)) : t("inbox.resolved" as TranslationKey)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "10px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#1A1D23" }}>
                    {conversationDetail.messages.filter((m) => !m.content?.startsWith("[system]") && !m.content?.startsWith("[note]")).length || 0}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94A3B8" }}>{t("inbox.messages" as TranslationKey)}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#1A1D23" }}>
                    {conversationDetail.messages.filter((m) => m.content?.startsWith("[note]")).length || 0}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94A3B8" }}>{t("inbox.notes.title")}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", borderBottom: `1px solid ${WARM_BORDER}` }}>
              {(["details", "notes"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: "transparent",
                    color: detailTab === tab ? "#F59E0B" : "#94A3B8",
                    borderBottom: detailTab === tab ? "2px solid #F59E0B" : "2px solid transparent",
                  }}
                >
                  {tab === "details" ? t("inbox.detail.details" as TranslationKey) : t("inbox.notes.title")}
                </button>
              ))}
            </div>

            {detailTab === "details" && (
              <div style={{ padding: "10px" }}>
                {(() => {
                  const baseFields = [
                    { icon: "🔗", label: t("inbox.detail.channel" as TranslationKey), value: selectedConvExtra?.channel || "Web Widget" },
                    { icon: "🆔", label: t("inbox.detail.identity" as TranslationKey), value: selectedConvExtra?.recipientId || "-" },
                    { icon: "📅", label: t("inbox.detail.created" as TranslationKey), value: formatTime(selectedConv?.createdAt || "", hydrated) },
                    { icon: "👤", label: t("inbox.detail.assigned" as TranslationKey), value: conversationDetail.assignedTo?.email?.split("@")[0] || t("inbox.detail.unassigned" as TranslationKey) },
                  ];
                  const standardFields = [
                    { icon: "📍", label: t("inbox.detail.location" as TranslationKey), value: selectedConvExtra?.country || "-" },
                    { icon: "📱", label: t("inbox.detail.device" as TranslationKey), value: selectedConvExtra?.browser || "-" },
                    { icon: "📄", label: t("inbox.detail.activePage" as TranslationKey), value: selectedConvExtra?.currentPage || "-" },
                    { icon: "⚡", label: t("inbox.detail.lastActivity" as TranslationKey), value: formatTime(selectedConv?.lastMessageAt || "", hydrated) },
                  ];
                  const fullFields = [
                    { icon: "🕐", label: t("inbox.detail.timeOnSite" as TranslationKey), value: selectedConvExtra?.timeOnSite || "-" },
                    { icon: "📊", label: t("inbox.detail.visitHistory" as TranslationKey), value: selectedConvExtra?.visitCount ? `${selectedConvExtra.visitCount} ${t("inbox.detail.visits" as TranslationKey)}` : "-" },
                  ];
                  const visibleFields = (() => {
                    if (planRank >= 2) return [...standardFields, ...baseFields, ...fullFields];
                    if (planRank >= 1) return [...standardFields, ...baseFields];
                    return baseFields;
                  })();
                  return (
                    <>
                      {visibleFields.map((field, i) => (
                        <div key={`${field.label}-${i}`} style={{ marginBottom: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "1px" }}>
                            <span style={{ fontSize: "14px" }}>{field.icon}</span>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.8px" }}>
                              {field.label}
                            </span>
                          </div>
                          <div style={{ fontSize: "14px", color: "#1A1D23", fontWeight: 500, whiteSpace: "pre-wrap", marginLeft: "22px" }}>
                            {field.value}
                          </div>
                        </div>
                      ))}

                      {planRank < 1 && (
                        <button
                          onClick={() => openUpgradeForPlan("starter", "visitorStandard")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "10px 12px",
                            borderRadius: "9px",
                            border: "1px solid #F3E8D8",
                            background: "#FAFAFA",
                            cursor: "pointer",
                            width: "100%",
                            marginTop: "4px",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F59E0B"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#F3E8D8"; }}
                        >
                          <span style={{ fontSize: "12px" }}>🔒</span>
                          <div style={{ textAlign: "left", flex: 1 }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1D23" }}>
                              {t("inbox.upgrade.visitorInfo" as TranslationKey)}
                            </div>
                            <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                              {t("inbox.upgrade.visitorInfoDesc" as TranslationKey)}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#fff",
                              background: "linear-gradient(135deg,#F59E0B,#D97706)",
                              padding: "3px 8px",
                              borderRadius: "5px",
                            }}
                          >
                            STARTER+
                          </span>
                        </button>
                      )}

                      {planRank >= 1 && planRank < 2 && (
                        <button
                          onClick={() => openUpgradeForPlan("pro", "visitorFull")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "10px 12px",
                            borderRadius: "9px",
                            border: "1px solid #F3E8D8",
                            background: "#FAFAFA",
                            cursor: "pointer",
                            width: "100%",
                            marginTop: "4px",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#8B5CF6"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#F3E8D8"; }}
                        >
                          <span style={{ fontSize: "12px" }}>🔒</span>
                          <div style={{ textAlign: "left", flex: 1 }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1D23" }}>
                              {t("inbox.upgrade.fullAnalytics" as TranslationKey)}
                            </div>
                            <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                              {t("inbox.upgrade.fullAnalyticsDesc" as TranslationKey)}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#fff",
                              background: "linear-gradient(135deg,#8B5CF6,#7C3AED)",
                              padding: "3px 8px",
                              borderRadius: "5px",
                            }}
                          >
                            PRO+
                          </span>
                        </button>
                      )}
                    </>
                  );
                })()}

                <div style={{ marginTop: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "10px" }}>🏷️</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8" }}>
                      {t("inbox.tags.title" as TranslationKey)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "3px", marginLeft: "18px", flexWrap: "wrap" }}>
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: "7px",
                          background: "#F1F5F9",
                          color: "#475569",
                          border: "1px solid #CBD5E1",
                          display: "flex",
                          alignItems: "center",
                          gap: "2px",
                        }}
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "8px", color: "inherit", padding: 0 }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => setShowTagBar(true)}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "7px",
                        background: "#FAFAFA",
                        color: "#94A3B8",
                        border: "1px dashed #E2E8F0",
                        cursor: "pointer",
                      }}
                    >
                      + {t("inbox.tags.add" as TranslationKey)}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {detailTab === "notes" && (
              <div style={{ padding: "10px" }}>
                {!canUseInternalNotes ? (
                  <button
                    onClick={() => openUpgradeForPlan("starter", "internalNotes")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "10px",
                      borderRadius: "9px",
                      border: "1px solid #F3E8D8",
                      background: "#FAFAFA",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <span style={{ fontSize: "14px" }}>🔒</span>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1D23" }}>{t("inbox.notes.title")}</div>
                      <div style={{ fontSize: "11px", color: "#94A3B8" }}>{t("inbox.upgrade.notesDesc" as TranslationKey)}</div>
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#fff",
                        background: "linear-gradient(135deg,#F59E0B,#D97706)",
                        padding: "3px 8px",
                        borderRadius: "5px",
                      }}
                    >
                      STARTER+
                    </span>
                  </button>
                ) : (
                  <>
                    {(conversationDetail.messages.filter((m) => m.content?.startsWith("[note]")) || []).length === 0 && (
                      <div style={{ textAlign: "center", padding: "14px", color: "#94A3B8", fontSize: "11px" }}>
                        {t("inbox.notes.empty" as TranslationKey)}
                      </div>
                    )}

                    {(conversationDetail.messages.filter((m) => m.content?.startsWith("[note]")) || []).map((note) => (
                      <div
                        key={note.id}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "9px",
                          background: "#FEF3C7",
                          border: "1px dashed #FCD34D",
                          marginBottom: "5px",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#92400E", marginBottom: "2px" }}>
                          📝 {user?.email?.split("@")[0] || "Agent"}
                        </div>
                        <p style={{ fontSize: "14px", color: "#78350F", margin: 0, lineHeight: 1.4 }}>
                          {note.content.replace(/^\[note\]\s*/i, "")}
                        </p>
                      </div>
                    ))}

                    <textarea
                      value={sidebarNoteText}
                      onChange={(e) => setSidebarNoteText(e.target.value)}
                      placeholder={t("inbox.notes.addPlaceholder" as TranslationKey)}
                      rows={2}
                      style={{
                        width: "100%",
                        border: "1px solid #F3E8D8",
                        borderRadius: "9px",
                        padding: "9px 11px",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        resize: "none",
                        outline: "none",
                        background: "#FAFAFA",
                        boxSizing: "border-box",
                        marginTop: "5px",
                      }}
                    />
                    <button
                      onClick={() => {
                        if (sidebarNoteText.trim()) {
                          handleSendNote(sidebarNoteText);
                          setSidebarNoteText("");
                        }
                      }}
                      disabled={!sidebarNoteText?.trim()}
                      style={{
                        marginTop: "3px",
                        padding: "7px",
                        borderRadius: "7px",
                        background: sidebarNoteText?.trim() ? "linear-gradient(135deg,#F59E0B,#D97706)" : "#E2E8F0",
                        color: sidebarNoteText?.trim() ? "#fff" : "#94A3B8",
                        border: "none",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: sidebarNoteText?.trim() ? "pointer" : "default",
                        width: "100%",
                      }}
                    >
                      📝 {t("inbox.notes.add" as TranslationKey)}
                    </button>
                  </>
                )}
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

      {upgradeModal?.show && (
        <div
          onClick={() => setUpgradeModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "20px",
              padding: "28px",
              maxWidth: "380px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "10px" }}>🚀</div>
              <h3
                style={{
                  fontSize: "19px",
                  fontWeight: 800,
                  color: "#1A1D23",
                  margin: "0 0 4px",
                }}
              >
                {t("inbox.upgrade.title" as TranslationKey)}
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "#64748B",
                  margin: "0 0 18px",
                  lineHeight: 1.5,
                }}
              >
                {t("inbox.upgrade.description" as TranslationKey)}
              </p>
            </div>

            {[
              {
                plan: "STARTER",
                price: "$19",
                features: t("inbox.upgrade.starterFeatures" as TranslationKey),
                color: "#F59E0B",
              },
              {
                plan: "PRO",
                price: "$79",
                features: t("inbox.upgrade.proFeatures" as TranslationKey),
                color: "#8B5CF6",
              },
              {
                plan: "ENTERPRISE",
                price: t("inbox.upgrade.custom" as TranslationKey),
                features: t("inbox.upgrade.enterpriseFeatures" as TranslationKey),
                color: "#059669",
              },
            ].map((p) => {
              const isMin = upgradeModal.minPlan.toUpperCase() === p.plan;
              return (
                <div
                  key={p.plan}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    textAlign: "left",
                    marginBottom: "6px",
                    border: isMin ? `2px solid ${p.color}` : "1px solid #F3E8D8",
                    background: isMin ? "#FFFBF5" : "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#1A1D23" }}>
                      {p.plan}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 800, color: p.color }}>
                      {p.price}/{t("inbox.upgrade.month" as TranslationKey)}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>
                    {p.features}
                  </div>
                  {isMin && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: p.color,
                        fontWeight: 700,
                        marginTop: "3px",
                      }}
                    >
                      ← {t("inbox.upgrade.minimumPlan" as TranslationKey)}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => {
                window.location.href = "/portal/pricing";
                setUpgradeModal(null);
              }}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "13px",
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff",
                border: "none",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                marginTop: "8px",
                boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
              }}
            >
              {t("inbox.upgrade.viewPlans" as TranslationKey)} →
            </button>

            <button
              onClick={() => setUpgradeModal(null)}
              style={{
                background: "none",
                border: "none",
                color: "#94A3B8",
                fontSize: "12px",
                cursor: "pointer",
                marginTop: "8px",
                display: "block",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {t("inbox.upgrade.notNow" as TranslationKey)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
