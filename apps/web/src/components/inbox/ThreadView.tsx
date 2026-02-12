"use client";

import { ArrowLeft, Pause, XCircle, Send, Paperclip, Smile, Type, Headphones, User } from "lucide-react";
import { useRef, useEffect, useMemo } from "react";
import { sanitizeHTML } from "@/utils/sanitize";

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ThreadViewProps {
  conversationId: string | null;
  displayName: string;
  avatarColor: string;
  initials: string;
  isOnline: boolean;
  messages: ThreadMessage[];
  isLoading: boolean;
  isUpdating: boolean;
  canClose: boolean;
  onBack: () => void;
  onPause: () => void;
  onClose: () => void;
  onAssign: (userId: string | null) => void;
  teamMembers: Array<{ id: string; email: string; isActive: boolean }>;
  assignedToId: string | null;
  onShowDetails?: () => void;
}

export default function ThreadView({
  conversationId,
  displayName,
  avatarColor,
  initials,
  isOnline,
  messages,
  isLoading,
  isUpdating,
  canClose,
  onBack,
  onPause,
  onClose,
  onAssign,
  teamMembers,
  assignedToId,
  onShowDetails,
}: ThreadViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sanitizedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        content: sanitizeHTML(message.content || ""),
      })),
    [messages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFFBF5]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-[#94A3B8]"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#334155] mb-1">No conversation selected</p>
          <p className="text-xs text-[#64748B]">Choose a conversation from the list to view messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0">
      {/* Header */}
      <div className="px-5 py-3.5 bg-white border-b border-[#F3E8D8] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="sm:hidden text-[#64748B] hover:text-[#334155] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarColor}`}
          >
            {initials}
          </div>
          <div>
            <div className="text-[15px] font-semibold text-[#1A1D23]">{displayName}</div>
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-[#CBD5E1]"}`} />
              {isOnline ? "Online" : "Offline"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPause}
            disabled={isUpdating}
            className="px-3 py-1.5 text-sm font-medium border border-[#E2E8F0] rounded-lg hover:bg-[#FFFBF5] text-[#334155] disabled:opacity-50 flex items-center gap-1.5 transition-all"
          >
            <Pause size={14} />
            <span className="hidden sm:inline">Pause</span>
          </button>
          <button
            onClick={onClose}
            disabled={isUpdating || !canClose}
            className="px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 flex items-center gap-1.5 transition-all"
          >
            <XCircle size={14} />
            <span className="hidden sm:inline">Close</span>
          </button>
          <select
            value={assignedToId || ""}
            onChange={(e) => onAssign(e.target.value || null)}
            disabled={isUpdating}
            className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 transition-all"
          >
            <option value="">Assign...</option>
            {teamMembers
              .filter((m) => m.isActive)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.email.split("@")[0]}
                </option>
              ))}
          </select>
          {onShowDetails && (
            <button
              onClick={onShowDetails}
              className="sm:hidden p-1.5 border border-[#F3E8D8] rounded-lg text-[#64748B] hover:bg-[#FFFBF5]"
            >
              <User size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-[#FFFBF5]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-[#F3E8D8] border-t-amber-600 animate-spin" />
          </div>
        ) : sanitizedMessages.length === 0 ? (
          <div className="text-center py-12 text-sm text-[#94A3B8]">No messages in this conversation</div>
        ) : (
          sanitizedMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
              {msg.role === "user" && (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mr-2.5 ${avatarColor}`}
                >
                  {initials}
                </div>
              )}
              <div
                className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-white border border-[#F3E8D8] text-[#1E293B] rounded-tl-sm shadow-sm"
                    : "bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-tr-sm shadow-md"
                }`}
              >
                <div
                  className="text-[14px] leading-relaxed break-words"
                  dangerouslySetInnerHTML={{ __html: msg.content }}
                />
                <div
                  className={`text-[11px] mt-1.5 text-right ${
                    msg.role === "user" ? "text-[#94A3B8]" : "text-white/70"
                  }`}
                  suppressHydrationWarning
                >
                  {msg.timestamp}
                </div>
              </div>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 ml-2.5 bg-gradient-to-r from-amber-500 to-amber-600 shadow-sm">
                  <Headphones size={13} />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="px-5 py-3.5 bg-white border-t border-[#F3E8D8] flex-shrink-0">
        <div className="flex items-center gap-2 mb-2.5">
          <input
            type="text"
            readOnly
            placeholder="Type a message..."
            title="Message sending is not yet supported"
            className="flex-1 px-4 py-2.5 text-sm border border-[#F3E8D8] rounded-lg bg-white placeholder:text-[#94A3B8] cursor-not-allowed focus:outline-none"
          />
          <button
            disabled
            className="px-5 py-2.5 bg-[#F26B3A] text-white rounded-lg font-semibold text-sm opacity-50 cursor-not-allowed flex items-center gap-1.5 shadow-sm"
          >
            Send <Send size={14} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-[#CBD5E1]">
          <button disabled title="Not supported" className="cursor-not-allowed hover:text-[#94A3B8]">
            <Paperclip size={16} />
          </button>
          <button disabled title="Not supported" className="cursor-not-allowed hover:text-[#94A3B8]">
            <Smile size={16} />
          </button>
          <button disabled title="Not supported" className="cursor-not-allowed hover:text-[#94A3B8]">
            <Type size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
