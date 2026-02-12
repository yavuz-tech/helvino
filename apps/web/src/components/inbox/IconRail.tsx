"use client";

import { MessageSquare, Settings, BarChart3, Users } from "lucide-react";

interface IconRailProps {
  activeView?: "inbox" | "settings" | "analytics" | "team";
  onViewChange?: (view: "inbox" | "settings" | "analytics" | "team") => void;
}

export default function IconRail({ activeView = "inbox", onViewChange }: IconRailProps) {
  const items = [
    { id: "inbox" as const, icon: MessageSquare, label: "Inbox" },
    { id: "analytics" as const, icon: BarChart3, label: "Analytics" },
    { id: "team" as const, icon: Users, label: "Team" },
    { id: "settings" as const, icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex flex-col w-[56px] bg-gradient-to-b from-amber-500 to-amber-600 flex-shrink-0">
      <div className="flex flex-col items-center py-4 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange?.(item.id)}
              title={item.label}
              className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <Icon size={20} strokeWidth={2} />
              
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#1A1D23] text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                {item.label}
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
