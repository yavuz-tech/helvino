"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDebug } from "@/contexts/DebugContext";
import { useOrg } from "@/contexts/OrgContext";
import { apiFetch, setDebugLogger } from "@/utils/api";
import { SystemStatus } from "@/components/SystemStatus";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";

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
  const { logRequest, socket, isMounted } = useDebug();
  const { selectedOrg, isLoading: orgLoading } = useOrg();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Conversation detail state
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const verifyAuth = async () => {
      const user = await checkAuth();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      setAuthLoading(false);
    };
    verifyAuth();
  }, [router]);

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
      const response = await apiFetch("/conversations", {
        orgKey: selectedOrg.key,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setConversations(data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
      setError("Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrg]);

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
      alert("Failed to send message");
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
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  // Show empty state if no org selected
  if (!selectedOrg && !orgLoading) {
    return (
      <DashboardLayout user={user} onLogout={handleLogout}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No Organization Selected</h2>
            <p className="text-slate-600 mb-6">
              Create your first organization to get started
            </p>
            <a
              href="/dashboard/orgs/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Create Organization
            </a>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      {/* System Status */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Overview</h1>
        <SystemStatus />
      </div>

      <div className="flex gap-6 h-[calc(100vh-16rem)]">
        {/* Left: Inbox List */}
        <div className="w-96 bg-white border-r border-slate-200 flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Inbox ({conversations.length})
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
              <div className="px-6 py-4 text-sm text-red-600">
                {error}
              </div>
            )}

            {isLoading && conversations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm font-medium text-slate-700 mb-1">No conversations yet</p>
                <p className="text-xs text-slate-500">
                  Conversations will appear here when visitors use the widget
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

        {/* Right: Conversation Detail */}
        <div className="flex-1 flex flex-col">
          {!selectedConversationId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="text-4xl mb-2">💬</div>
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages Thread */}
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
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-md px-4 py-2 rounded-lg ${
                            msg.role === "user"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-900"
                          }`}
                        >
                          <div className="text-sm mb-1">{msg.content}</div>
                          <div className={`text-xs ${msg.role === "user" ? "text-slate-300" : "text-slate-500"}`}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : null}
              </div>

              {/* Agent Reply Box */}
              <div className="border-t border-slate-200 p-4 bg-white">
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
                    placeholder="Type agent reply..."
                    disabled={isSending}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
                  />
                  <button
                    onClick={sendReply}
                    disabled={isSending || !replyContent.trim()}
                    className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
                  >
                    {isSending ? "Sending..." : "Send"}
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Press Enter to send • Shift+Enter for new line
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
