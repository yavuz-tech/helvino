"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { checkOrgAuth, orgLogout, orgApiFetch, type OrgUser } from "@/lib/org-auth";
import OrgPortalLayout from "@/components/OrgPortalLayout";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";

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

export default function OrgPortalPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<OrgUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      const user = await checkOrgAuth();
      if (!user) {
        router.push("/org-app/login");
        return;
      }
      setUser(user);
      setAuthLoading(false);
    };
    verifyAuth();
  }, [router]);

  const handleLogout = async () => {
    await orgLogout();
    router.push("/org-app/login");
  };

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await orgApiFetch("/org/conversations");
      
      if (!response.ok) {
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
  }, [t]);

  useEffect(() => {
    if (authLoading) return;
    fetchConversations();
  }, [authLoading, fetchConversations]);

  const fetchConversationDetail = useCallback(async (conversationId: string) => {
    try {
      setIsLoadingDetail(true);
      const response = await orgApiFetch(`/org/conversations/${conversationId}`);
      
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
  }, []);

  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    fetchConversationDetail(conversationId);
  };

  const sendReply = async () => {
    if (!selectedConversationId || !replyContent.trim() || isSending) return;

    const content = replyContent.trim();
    setReplyContent("");
    setIsSending(true);

    try {
      const response = await orgApiFetch(`/org/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          role: "assistant",
          content,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const message = await response.json();

      setConversationDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, message],
        };
      });

      setConversations((prev) => {
        return prev.map((conv) => {
          if (conv.id === selectedConversationId) {
            return {
              ...conv,
              messageCount: conv.messageCount + 1,
              updatedAt: message.timestamp,
            };
          }
          return conv;
        });
      });
    } catch (err) {
      console.error("Failed to send reply:", err);
      premiumToast.error({
        title: t("dashboard.failedSendMessage"),
        description: err instanceof Error ? err.message : undefined,
      });
      setReplyContent(content);
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const shortId = (id: string) => {
    return id.substring(0, 12) + "...";
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
        <div className="text-[#475569]">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <OrgPortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1D23]">{t("app.conversations")}</h1>
        <p className="text-sm text-[#475569] mt-1">
          {t("app.conversationsSubtitle")} {user?.orgName}
        </p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        <div className="w-96 bg-white rounded-lg border border-[#F3E8D8] flex flex-col">
          <div className="px-6 py-4 border-b border-[#F3E8D8]">
            <h2 className="text-lg font-semibold text-[#1A1D23] mb-1">
              {t("app.inbox")} ({conversations.length})
            </h2>
            <button
              onClick={fetchConversations}
              disabled={isLoading}
              className="text-xs text-[#475569] hover:text-[#1A1D23] disabled:text-[#94A3B8]"
            >
              {isLoading ? t("common.loading") : `↻ ${t("common.refresh")}`}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#F3E8D8]">
            {error && (
              <div className="px-6 py-4 text-sm text-red-600">
                {error}
              </div>
            )}

            {isLoading && conversations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-[#64748B]">
                {t("dashboard.loadingConversations")}
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm font-medium text-[#334155] mb-1">{t("dashboard.noConversationsYet")}</p>
                <p className="text-xs text-[#64748B]">
                  {t("dashboard.conversationsHint")}
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`px-6 py-4 cursor-pointer transition-colors ${
                    selectedConversationId === conv.id
                      ? "bg-amber-100/80"
                      : "hover:bg-[#FFFBF5]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs font-mono text-[#1A1D23]">
                      {shortId(conv.id)}
                    </code>
                    <span className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-medium text-amber-800">
                      {conv.messageCount}
                    </span>
                  </div>
                  <div className="text-xs text-[#64748B]" suppressHydrationWarning>
                    {formatDate(conv.updatedAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg border border-[#F3E8D8] flex flex-col">
          {!selectedConversationId ? (
            <div className="flex-1 flex items-center justify-center text-[#94A3B8]">
              <div className="text-center">
                <div className="text-4xl mb-2">💬</div>
                <p>{t("dashboard.selectConversation")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {isLoadingDetail ? (
                  <div className="text-center text-[#64748B] py-8">
                    {t("dashboard.loadingMessages")}
                  </div>
                ) : conversationDetail ? (
                  conversationDetail.messages.length === 0 ? (
                    <div className="text-center text-[#94A3B8] py-8">
                      {t("dashboard.noMessages")}
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
                              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                              : "bg-amber-50 text-[#1A1D23]"
                          }`}
                        >
                          <div className="text-sm mb-1">{msg.content}</div>
                          <div className={`text-xs ${msg.role === "user" ? "text-amber-100" : "text-[#64748B]"}`} suppressHydrationWarning>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : null}
              </div>

              <div className="border-t border-[#F3E8D8] p-4">
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
                    placeholder={t("app.typeReply")}
                    disabled={isSending}
                    className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-[#F1F5F9]"
                  />
                  <button
                    onClick={sendReply}
                    disabled={isSending || !replyContent.trim()}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-2 rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors disabled:from-amber-300 disabled:to-amber-300"
                  >
                    {isSending ? t("common.sending") : t("common.send")}
                  </button>
                </div>
                <div className="mt-2 text-xs text-[#64748B]">
                  {t("app.pressEnter")}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </OrgPortalLayout>
  );
}
