/**
 * MetricCard — Premium KPI card with optional progress bar
 */

interface MetricCardProps {
  label: string;
  value: string;
  target?: string;
  percentage: number;
  status?: "excellent" | "good" | "warning";
  className?: string;
}

export default function MetricCard({
  label,
  value,
  target,
  percentage,
  status = "good",
  className = "",
}: MetricCardProps) {
  const statusColors = {
    excellent: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    good: "bg-gradient-to-r from-amber-500 to-amber-600",
    warning: "bg-gradient-to-r from-amber-500 to-orange-500",
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-medium text-amber-700">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold text-amber-900">
            {value}
          </span>
          {target && (
            <span className="text-xs text-amber-500">
              / {target}
            </span>
          )}
        </div>
      </div>
      <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${statusColors[status]}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
