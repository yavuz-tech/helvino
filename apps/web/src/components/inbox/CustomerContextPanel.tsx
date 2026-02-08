"use client";

import { ArrowLeft } from "lucide-react";
import { useState } from "react";

export interface CustomerNote {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; email: string; role: string };
  authorInitials: string;
  authorColor: string;
}

export interface CustomerContextPanelProps {
  conversationId: string | null;
  displayName: string;
  avatarColor: string;
  initials: string;
  channel: string;
  phone: string;
  address: string;
  notes: CustomerNote[];
  noteBody: string;
  onNoteBodyChange: (body: string) => void;
  onAddNote: () => void;
  isSubmittingNote: boolean;
  onBack?: () => void;
  isMobileVisible?: boolean;
}

export default function CustomerContextPanel({
  conversationId,
  displayName,
  avatarColor,
  initials,
  channel,
  phone,
  address,
  notes,
  noteBody,
  onNoteBodyChange,
  onAddNote,
  isSubmittingNote,
  onBack,
  isMobileVisible,
}: CustomerContextPanelProps) {
  const [showAddAttribute, setShowAddAttribute] = useState(false);

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Select a conversation to view details</p>
      </div>
    );
  }

  return (
    <div
      className={`w-[340px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-y-auto ${
        isMobileVisible
          ? "flex fixed inset-0 z-50 w-full bg-white lg:static lg:w-[340px]"
          : "hidden lg:flex"
      }`}
    >
      {/* Mobile back button */}
      {isMobileVisible && onBack && (
        <div className="lg:hidden px-4 py-3 border-b border-slate-100">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      )}

      {/* Customer header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white ${avatarColor}`}>
            {initials}
          </div>
          <div>
            <div className="text-[15px] font-semibold text-slate-900">{displayName}</div>
            <div className="text-xs text-slate-500">Customer</div>
          </div>
        </div>
      </div>

      {/* Attributes */}
      <div className="px-5 py-4 border-b border-slate-100 space-y-3.5">
        <AttributeField
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect x="2" y="9" width="4" height="12" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          }
          label="Channel"
          value={channel}
        />
        <AttributeField
          icon={<span className="text-sm text-slate-400">#</span>}
          label="ID"
          value={conversationId.substring(0, 16)}
        />
        <AttributeField
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          }
          label="Phone"
          value={phone}
        />
        <AttributeField
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          }
          label="Address"
          value={address}
        />

        <button
          onClick={() => setShowAddAttribute(!showAddAttribute)}
          className="w-full py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add attribute
        </button>
      </div>

      {/* Notes section */}
      <div className="px-5 py-4 flex-1 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Internal Notes</h3>

        {/* Note composer */}
        <div className="mb-4">
          <textarea
            value={noteBody}
            onChange={(e) => onNoteBodyChange(e.target.value)}
            placeholder="Add an internal note (visible only to your team)..."
            maxLength={2000}
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all"
          />
          <div className="flex items-center justify-end mt-2">
            <button
              onClick={onAddNote}
              disabled={!noteBody.trim() || isSubmittingNote}
              className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Add Note
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className="space-y-3 flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No notes yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="flex gap-2.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${note.authorColor}`}
                >
                  {note.authorInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-800">
                      {note.author.email.split("@")[0]}
                    </span>
                    <span className="text-[11px] text-slate-400" suppressHydrationWarning>
                      {note.createdAt}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AttributeField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-slate-400 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-slate-500 font-medium mb-0.5">{label}</div>
        <div className="text-sm text-slate-800 font-medium break-words">{value || "—"}</div>
      </div>
    </div>
  );
}
