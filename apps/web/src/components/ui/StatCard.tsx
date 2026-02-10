import type { LucideIcon } from "lucide-react";
import { p } from "@/styles/theme";

type Props = {
  label: string;
  value: string;
  icon: LucideIcon;
  color?: "blue" | "indigo" | "violet" | "emerald" | "amber" | "rose" | "slate";
  trend?: string;
  trendUp?: boolean;
};

const COLOR_MAP: Record<string, string> = {
  blue: p.iconBlue,
  indigo: p.iconIndigo,
  violet: p.iconViolet,
  emerald: p.iconEmerald,
  amber: p.iconAmber,
  rose: p.iconRose,
  slate: p.iconSlate,
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue",
  trend,
  trendUp = true,
}: Props) {
  return (
    <div className={`${p.card} ${p.cardHover} p-5`}>
      <div className="mb-3 flex items-start justify-between">
        <div className={`${p.iconSm} ${COLOR_MAP[color] || COLOR_MAP.blue}`}>
          <Icon size={15} strokeWidth={2} />
        </div>
        {trend && (
          <span className={trendUp ? p.badgeGreen : p.badgeRed}>
            {trendUp ? "+" : ""}{trend}
          </span>
        )}
      </div>
      <p className={p.overline}>{label}</p>
      <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}
