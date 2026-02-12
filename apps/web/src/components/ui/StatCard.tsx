"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  label?: string;
  title?: string;
  value: string;
  icon?: LucideIcon;
  emoji?: string;
  subtitle?: string;
  color?: "blue" | "indigo" | "violet" | "emerald" | "amber" | "rose" | "slate";
  trend?: string;
  trendUp?: boolean;
  gradient?: string;
  className?: string;
};

const COLOR_MAP: Record<string, string> = {
  blue: "from-blue-500 to-blue-600",
  indigo: "from-indigo-500 to-indigo-600",
  violet: "from-violet-500 to-violet-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
  slate: "from-slate-500 to-slate-600",
};

export default function StatCard({
  label,
  title,
  value,
  icon: Icon,
  emoji,
  subtitle,
  color = "blue",
  trend,
  trendUp = true,
  gradient,
  className = "",
}: Props) {
  const resolvedGradient = gradient || COLOR_MAP[color] || COLOR_MAP.blue;
  const resolvedLabel = title || label || "";

  if (emoji) {
    return (
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        className={`relative h-full min-h-[210px] overflow-hidden rounded-3xl border border-white/30 p-6 shadow-[0_12px_36px_rgba(26,29,35,0.14)] ${className}`}
        style={{ background: resolvedGradient }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-sm" />
        <div className="relative z-10">
          <div className="text-[36px] leading-none">{emoji}</div>
          <p className="mt-5 font-[var(--font-heading)] text-[40px] font-bold leading-none text-white tabular-nums">{value}</p>
          <p className="mt-2 font-[var(--font-body)] text-[15px] font-semibold text-white/90">{resolvedLabel}</p>
          {trend ? (
            <span className="mt-4 inline-flex rounded-full border border-white/35 bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {trend}
            </span>
          ) : null}
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-[#F3E8D8] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(26,26,46,0.08)] hover:shadow-[0_4px_12px_rgba(245,158,11,0.08),0_16px_40px_rgba(26,26,46,0.14)] transition-all duration-200 group ${className}`}>
      <div className="mb-3 flex items-start justify-between">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${resolvedGradient} flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}>
            <Icon size={18} className="text-white" strokeWidth={2.5} />
          </div>
        )}
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trendUp ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
            <span>{trendUp ? "↑" : "↓"}</span>
            <span>{trend}</span>
          </div>
        )}
      </div>
      <p className="text-[11px] font-semibold text-amber-500 mb-1 uppercase tracking-wider">{resolvedLabel}</p>
      <p className="text-2xl font-bold text-amber-900 tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-amber-600 mt-0.5">{subtitle}</p>}
    </div>
  );
}
