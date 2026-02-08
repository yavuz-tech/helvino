/**
 * Badge — Consistent status/label badge component
 */

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "premium";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

export default function Badge({
  children,
  variant = "default",
  size = "sm",
  className = "",
}: BadgeProps) {
  const variantClasses = {
    default: "bg-slate-100 text-slate-700 border-slate-200/80",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    warning: "bg-amber-50 text-amber-700 border-amber-200/80",
    danger: "bg-red-50 text-red-700 border-red-200/80",
    info: "bg-sky-50 text-sky-700 border-sky-200/80",
    premium: "bg-gradient-to-r from-[#1A1A2E] to-[#2D2D44] text-white border-transparent",
  };

  const sizeClasses = {
    sm: "px-2.5 py-0.5 text-[11px]",
    md: "px-3 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}
