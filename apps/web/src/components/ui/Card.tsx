type CardVariant = "default" | "elevated" | "muted" | "outlined";

type Props = {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  focusable?: boolean;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  noPadding?: boolean;
  variant?: CardVariant;
};

export default function Card({
  children,
  className = "",
  hover = true,
  focusable = false,
  padding = "md",
  noPadding = false,
  variant = "default",
}: Props) {
  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
    xl: "p-8 sm:p-10",
  };

  const variantClasses = {
    default:
      "bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(75,69,255,0.06)]",
    elevated:
      "bg-white border border-[#EDEDFF] shadow-[0_4px_16px_rgba(0,0,0,0.06),0_12px_32px_rgba(75,69,255,0.08)]",
    muted:
      "bg-[#F7F8FA]/80 border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    outlined:
      "bg-white border-2 border-slate-200/80 shadow-none",
  };

  const resolvedPadding = noPadding ? "none" : padding;

  return (
    <div
      className={`rounded-2xl ${variantClasses[variant]} ${paddingClasses[resolvedPadding]} ${
        hover
          ? "transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_rgba(75,69,255,0.10)] hover:-translate-y-0.5 hover:border-[#4B45FF]/30"
          : ""
      } ${
        focusable ? "focus-within:ring-2 focus-within:ring-[#4B45FF]/20 focus-within:border-[#4B45FF]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
