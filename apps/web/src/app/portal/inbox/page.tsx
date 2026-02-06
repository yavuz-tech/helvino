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

export default function PortalInboxPage() {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [conversationDetail, setConversationDetail] =
    useState<ConversationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

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
      setError("Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetchConversations();
  }, [authLoading, fetchConversations]);

  const fetchConversationDetail = useCallback(async (conversationId: string) => {
    try {
      setIsLoadingDetail(true);
      const response = await portalApiFetch(
        `/portal/conversations/${conversationId}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setConversationDetail(data);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    fetchConversationDetail(conversationId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const shortId = (id: string) => `${id.substring(0, 12)}...`;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <PortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
        <p className="text-sm text-slate-600 mt-1">
          Read-only view of your conversations
        </p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        <div className="w-96 bg-white rounded-lg border border-slate-200 flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Conversations ({conversations.length})
            </h2>
            <button
              onClick={fetchConversations}
              disabled={isLoading}
              className="text-xs text-slate-600 hover:text-slate-900 disabled:text-slate-400"
            >
              {isLoading ? "Loading..." : "↻ Refresh"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {error && (
              <div className="px-6 py-4 text-sm text-red-600">{error}</div>
            )}

            {isLoading && conversations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  No conversations yet
                </p>
                <p className="text-xs text-slate-500">
                  Conversations appear when visitors use the widget
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`px-6 py-4 cursor-pointer transition-colors ${
                    selectedConversationId === conv.id
                      ? "bg-slate-100"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs font-mono text-slate-900">
                      {shortId(conv.id)}
                    </code>
                    <span className="px-1.5 py-0.5 bg-slate-200 rounded text-xs font-medium text-slate-700">
                      {conv.messageCount}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDate(conv.updatedAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg border border-slate-200 flex flex-col">
          {!selectedConversationId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="text-4xl mb-2">💬</div>
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isLoadingDetail ? (
                <div className="text-center text-slate-500 py-8">
                  Loading messages...
                </div>
              ) : conversationDetail ? (
                conversationDetail.messages.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    No messages yet
                  </div>
                ) : (
                  conversationDetail.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-md px-4 py-2 rounded-lg ${
                          msg.role === "user"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        <div className="text-sm mb-1">{msg.content}</div>
                        <div
                          className={`text-xs ${
                            msg.role === "user"
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : null}
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
