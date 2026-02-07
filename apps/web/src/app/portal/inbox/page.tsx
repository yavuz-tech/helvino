"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/PortalLayout";
import {
  checkPortalAuth,
  portalLogout,
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { CheckCircle, Circle, User, MessageSquare, Send } from "lucide-react";
import ErrorBanner from "@/components/ErrorBanner";
import { useHydrated } from "@/hooks/useHydrated";

interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status?: string;
  assignedTo?: { id: string; email: string; role: string } | null;
  closedAt?: string | null;
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

export default function PortalInboxPage() {
  const router = useRouter();
  const { t } = useI18n();
  const hydrated = useHydrated();

  const [user, setUser] = useState<PortalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Status/assignment update
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const verify = async () => {
      const portalUser = await checkPortalAuth();
      if (!portalUser) {
        router.push("/portal/login");
        return;
      }
      setUser(portalUser);
      setAuthLoading(false);
    };
    verify();
  }, [router]);

  const handleLogout = async () => {
    await portalLogout();
    router.push("/portal/login");
  };

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await portalApiFetch("/portal/team/users");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.users || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchTeamMembers();
    }
  }, [authLoading, user, fetchTeamMembers]);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await portalApiFetch("/portal/conversations");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setConversations(data);
    } catch {
      setError(t("dashboard.failedLoadConversations"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading) return;
    fetchConversations();
  }, [authLoading, fetchConversations]);

  const fetchConversationDetail = useCallback(async (conversationId: string) => {
    try {
      setIsLoadingDetail(true);
      const response = await portalApiFetch(`/portal/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setConversationDetail(data);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const fetchNotes = useCallback(async (conversationId: string) => {
    try {
      const response = await portalApiFetch(`/portal/conversations/${conversationId}/notes`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch {
      // silent
    }
  }, []);

  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    fetchConversationDetail(conversationId);
    fetchNotes(conversationId);
  };

  const handleStatusChange = async (newStatus: "OPEN" | "CLOSED") => {
    if (!selectedConversationId || !conversationDetail) return;
    setIsUpdating(true);
    try {
      const response = await portalApiFetch(`/portal/conversations/${selectedConversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        const data = await response.json();
        setConversationDetail({
          ...conversationDetail,
          status: data.conversation.status,
          closedAt: data.conversation.closedAt,
        });
        // Update in list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId
              ? { ...c, status: data.conversation.status, closedAt: data.conversation.closedAt }
              : c
          )
        );
      }
    } catch {
      // silent
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignmentChange = async (userId: string | null) => {
    if (!selectedConversationId || !conversationDetail) return;
    setIsUpdating(true);
    try {
      const response = await portalApiFetch(`/portal/conversations/${selectedConversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ assignedToUserId: userId }),
      });
      if (response.ok) {
        const data = await response.json();
        setConversationDetail({
          ...conversationDetail,
          assignedTo: data.conversation.assignedTo,
        });
        // Update in list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId ? { ...c, assignedTo: data.conversation.assignedTo } : c
          )
        );
      }
    } catch {
      // silent
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedConversationId || !noteBody.trim()) return;
    if (noteBody.length > 2000) {
      setNoteError(t("inbox.noteTooLong"));
      return;
    }

    setIsSubmittingNote(true);
    setNoteError(null);
    try {
      const response = await portalApiFetch(`/portal/conversations/${selectedConversationId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      if (response.ok) {
        const data = await response.json();
        setNotes((prev) => [data.note, ...prev]);
        setNoteBody("");
      } else {
        const errData = await response.json().catch(() => ({}));
        setNoteError(errData.error?.message || `HTTP ${response.status}`);
      }
    } catch (err: unknown) {
      setNoteError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!hydrated) return dateString.replace("T", " ").slice(0, 19);
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const shortId = (id: string) => `${id.substring(0, 12)}...`;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">{t("common.loading")}</div>
      </div>
    );
  }

  const currentStatus = conversationDetail?.status || "OPEN";
  const isOpen = currentStatus === "OPEN";

  return (
    <PortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("nav.inbox")}</h1>
        <p className="text-sm text-slate-600 mt-1">{t("portal.inboxSubtitle")}</p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* Conversation List */}
        <div className="w-96 bg-white rounded-lg border border-slate-200 flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              {t("portal.conversationCount")} ({conversations.length})
            </h2>
            <button
              onClick={fetchConversations}
              disabled={isLoading}
              className="text-xs text-slate-600 hover:text-slate-900 disabled:text-slate-400"
            >
              {isLoading ? t("common.loading") : `↻ ${t("common.refresh")}`}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {error && <ErrorBanner message={error} />}

            {isLoading && conversations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500">
                {t("dashboard.loadingConversations")}
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  {t("portal.noConversations")}
                </p>
                <p className="text-xs text-slate-500">{t("portal.conversationsAppearHere")}</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`px-6 py-4 cursor-pointer transition-colors ${
                    selectedConversationId === conv.id ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs font-mono text-slate-900">{shortId(conv.id)}</code>
                    <span className="px-1.5 py-0.5 bg-slate-200 rounded text-xs font-medium text-slate-700">
                      {conv.messageCount}
                    </span>
                    {conv.status === "CLOSED" && (
                      <span className="px-1.5 py-0.5 bg-slate-400 text-white rounded text-xs font-medium">
                        {t("inbox.statusClosed")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500" suppressHydrationWarning>
                    {formatDate(conv.updatedAt)}
                  </div>
                  {conv.assignedTo && (
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <User size={12} />
                      {conv.assignedTo.email}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 bg-white rounded-lg border border-slate-200 flex flex-col">
          {!selectedConversationId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="text-4xl mb-2">💬</div>
                <p>{t("portal.selectToView")}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header with controls */}
              <div className="px-6 py-4 border-b border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <code className="text-sm font-mono text-slate-900">
                    {shortId(selectedConversationId)}
                  </code>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      isOpen
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {isOpen ? <Circle size={12} /> : <CheckCircle size={12} />}
                    {isOpen ? t("inbox.statusOpen") : t("inbox.statusClosed")}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status toggle */}
                  <button
                    onClick={() => handleStatusChange(isOpen ? "CLOSED" : "OPEN")}
                    disabled={isUpdating}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    {isOpen ? t("inbox.closeConversation") : t("inbox.reopenConversation")}
                  </button>

                  {/* Assignment dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 font-medium">
                      {t("inbox.assignTo")}:
                    </label>
                    <select
                      value={conversationDetail?.assignedTo?.id || ""}
                      onChange={(e) => handleAssignmentChange(e.target.value || null)}
                      disabled={isUpdating}
                      className="px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:opacity-50"
                    >
                      <option value="">{t("inbox.unassigned")}</option>
                      {teamMembers
                        .filter((m) => m.isActive)
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.email} ({member.role})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                {isLoadingDetail ? (
                  <div className="text-center text-slate-500 py-8">{t("portal.loadingMessages")}</div>
                ) : conversationDetail ? (
                  conversationDetail.messages.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      {t("portal.noMessagesYet")}
                    </div>
                  ) : (
                    conversationDetail.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-md px-4 py-2 rounded-lg ${
                            msg.role === "user"
                              ? "bg-slate-900 text-white"
                              : "bg-white text-slate-900 border border-slate-200"
                          }`}
                        >
                          <div className="text-sm mb-1">{msg.content}</div>
                          <div
                            className={`text-xs ${
                              msg.role === "user" ? "text-slate-300" : "text-slate-500"
                            }`}
                            suppressHydrationWarning
                          >
                            {formatDate(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : null}
              </div>

              {/* Notes Section */}
              <div className="border-t border-slate-200 p-6 bg-white max-h-96 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={18} className="text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-900">{t("inbox.notesTitle")}</h3>
                </div>

                {noteError && <ErrorBanner message={noteError} />}

                {/* Add note */}
                <div className="mb-4">
                  <textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder={t("inbox.notePlaceholder")}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                    rows={3}
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">
                      {noteBody.length} / 2000
                    </span>
                    <button
                      onClick={handleAddNote}
                      disabled={!noteBody.trim() || isSubmittingNote || noteBody.length > 2000}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={14} />
                      {t("inbox.noteSubmit")}
                    </button>
                  </div>
                </div>

                {/* Notes list */}
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      {t("inbox.noteEmpty")}
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700">
                            {note.author.email}
                          </span>
                          <span className="text-xs text-slate-400" suppressHydrationWarning>
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{note.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
