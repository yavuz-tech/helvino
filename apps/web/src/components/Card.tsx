/**
 * Card — Consistent card wrapper with premium styling
 */

type CardVariant = "default" | "elevated" | "muted" | "outlined";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  focusable?: boolean;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  variant?: CardVariant;
}

export default function Card({
  children,
  className = "",
  hover = false,
  focusable = false,
  padding = "md",
  variant = "default",
}: CardProps) {
  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
    xl: "p-8 sm:p-10",
  };

  const variantClasses = {
    default:
      "bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(26,26,46,0.08)]",
    elevated:
      "bg-white border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.06),0_12px_32px_rgba(26,26,46,0.10)]",
    muted:
      "bg-slate-50/80 border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    outlined:
      "bg-white border-2 border-slate-200 shadow-none",
  };

  return (
    <div
      className={`rounded-2xl ${variantClasses[variant]} ${paddingClasses[padding]} ${
        hover
          ? "transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_rgba(26,26,46,0.14)] hover:-translate-y-0.5 hover:border-slate-300"
          : ""
      } ${focusable ? "focus-within:ring-2 focus-within:ring-[#1A1A2E]/10 focus-within:border-[#1A1A2E]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
