"use client";

import { User } from "lucide-react";

export interface ConversationItem {
  id: string;
  displayName: string;
  preview: string;
  timestamp: string;
  unreadCount: number;
  status: "OPEN" | "CLOSED";
  assignedTo: { id: string; email: string } | null;
  avatarColor: string;
  initials: string;
}

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  onLoadMore,
  hasMore,
}: ConversationListProps) {
  if (isLoading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-slate-400"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600 mb-1">No conversations</p>
        <p className="text-xs text-slate-400">New chats will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => {
        const isActive = conv.id === selectedId;
        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(conv.id);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Conversation with ${conv.displayName}`}
            className={`group px-4 py-3.5 cursor-pointer border-b border-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
              isActive ? "bg-blue-50/60 border-blue-100" : "hover:bg-slate-50"
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${conv.avatarColor}`}
              >
                {conv.initials}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Name + Time */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {conv.displayName}
                  </span>
                  <span
                    className="text-[11px] text-slate-400 flex-shrink-0 ml-2"
                    suppressHydrationWarning
                  >
                    {conv.timestamp}
                  </span>
                </div>

                {/* Preview */}
                <p className="text-[13px] text-slate-600 truncate mb-2">{conv.preview}</p>

                {/* Meta row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    {conv.assignedTo && (
                      <span className="flex items-center gap-1">
                        <User size={10} />
                        {conv.assignedTo.email.split("@")[0]}
                      </span>
                    )}
                    {conv.status === "CLOSED" && (
                      <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-semibold">
                        Closed
                      </span>
                    )}
                  </div>

                  {/* Unread badge */}
                  {conv.unreadCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 bg-[#F26B3A] text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Load More */}
      {hasMore && (
        <div className="px-4 py-3 text-center border-b border-slate-100">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
