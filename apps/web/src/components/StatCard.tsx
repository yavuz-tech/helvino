/**
 * StatCard — Premium stat/metric card component for dashboards
 */

import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  gradient?: string;
  className?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  gradient = "from-[#1A1A2E] to-[#2D2D44]",
  className = "",
}: StatCardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(26,26,46,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_rgba(26,26,46,0.14)] transition-all duration-200 group ${className}`}>
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}>
            <Icon size={18} className="text-white" strokeWidth={2.5} />
          </div>
        )}
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trendUp ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
          }`}>
            <span>{trendUp ? "↑" : "↓"}</span>
            <span>{trend}</span>
          </div>
        )}
      </div>

      <p className="text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
        {title}
      </p>
      <p className="text-2xl font-bold text-slate-900 tracking-tight">
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}
