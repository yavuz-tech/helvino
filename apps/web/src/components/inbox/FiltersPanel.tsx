"use client";

import { Search } from "lucide-react";

export interface FilterCounts {
  all: number;
  assignedToMe: number;
  unassigned: number;
  open: number;
  closed: number;
  awaitingAgent: number;
  withAgent: number;
}

interface FiltersPanelProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeInboxFilter: "all" | "assignedToMe" | "unassigned";
  onInboxFilterChange: (filter: "all" | "assignedToMe" | "unassigned") => void;
  activeStatusFilter: "all" | "open" | "closed";
  onStatusFilterChange: (filter: "all" | "open" | "closed") => void;
  counts: FilterCounts;
  currentUserId?: string;
}

export default function FiltersPanel({
  searchQuery,
  onSearchChange,
  activeInboxFilter,
  onInboxFilterChange,
  activeStatusFilter,
  onStatusFilterChange,
  counts,
}: FiltersPanelProps) {
  return (
    <div className="flex flex-col w-[260px] bg-white border-r border-[#F3E8D8] flex-shrink-0">
      {/* Search */}
      <div className="px-4 py-3.5 border-b border-[#F3E8D8]">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#F3E8D8] rounded-lg bg-white placeholder:text-[#94A3B8] focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
          />
        </div>
      </div>

      {/* INBOX filters */}
      <div className="px-4 py-3 border-b border-[#F3E8D8]">
        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2.5 px-1">
          Inbox
        </div>
        <div className="space-y-0.5">
          <FilterItem
            label="All conversations"
            count={counts.all}
            active={activeInboxFilter === "all"}
            onClick={() => onInboxFilterChange("all")}
          />
          <FilterItem
            label="Assigned to me"
            count={counts.assignedToMe}
            active={activeInboxFilter === "assignedToMe"}
            onClick={() => onInboxFilterChange("assignedToMe")}
          />
          <FilterItem
            label="Unassigned"
            count={counts.unassigned}
            active={activeInboxFilter === "unassigned"}
            onClick={() => onInboxFilterChange("unassigned")}
          />
        </div>
      </div>

      {/* STATUS filters */}
      <div className="px-4 py-3 border-b border-[#F3E8D8]">
        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2.5 px-1">
          Status
        </div>
        <div className="space-y-0.5">
          <FilterItem
            label="All"
            count={counts.all}
            active={activeStatusFilter === "all"}
            onClick={() => onStatusFilterChange("all")}
          />
          <FilterItem
            label="Open"
            count={counts.open}
            active={activeStatusFilter === "open"}
            onClick={() => onStatusFilterChange("open")}
          />
          <FilterItem
            label="With agent"
            count={counts.withAgent}
            active={false}
            onClick={() => {}}
          />
          <FilterItem
            label="Awaiting agent"
            count={counts.awaitingAgent}
            active={false}
            onClick={() => {}}
          />
          <FilterItem
            label="Closed"
            count={counts.closed}
            active={activeStatusFilter === "closed"}
            onClick={() => onStatusFilterChange("closed")}
          />
        </div>
      </div>

      {/* CHANNEL filters (static for now) */}
      <div className="px-4 py-3 border-b border-[#F3E8D8]">
        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2.5 px-1">
          Channel
        </div>
        <div className="space-y-0.5">
          <FilterItem label="All" count={counts.all} active onClick={() => {}} />
          <FilterItem label="Web widget" count={counts.all} active={false} onClick={() => {}} />
          <FilterItem label="WhatsApp" count={0} active={false} onClick={() => {}} />
          <FilterItem label="Instagram" count={0} active={false} onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}

function FilterItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-amber-50 text-amber-700"
          : "text-[#334155] hover:bg-[#FFFBF5]"
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`text-xs font-semibold tabular-nums flex-shrink-0 ml-2 ${
          active ? "text-amber-600" : "text-[#94A3B8]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
