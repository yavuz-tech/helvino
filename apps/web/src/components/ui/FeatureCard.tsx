"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { createElement, isValidElement, type ReactNode } from "react";

type Props = {
  icon: ReactNode | LucideIcon;
  title: string;
  description: string;
  className?: string;
  href?: string;
  gradient?: string;
  cardClassName?: string;
};

function renderIcon(icon: ReactNode | LucideIcon, gradient: string) {
  if (typeof icon === "function" || (icon && typeof icon === "object" && !isValidElement(icon))) {
    const Icon = icon as LucideIcon;
    return (
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
        {createElement(Icon, { size: 22, className: "text-white", strokeWidth: 2 })}
      </div>
    );
  }
  return (
    <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_8px_20px_rgba(26,29,35,0.14)]" style={{ background: gradient }}>
      <span className="text-[40px] leading-none">{icon}</span>
    </div>
  );
}

export default function FeatureCard({
  icon,
  title,
  description,
  className = "",
  href,
  gradient = "linear-gradient(135deg, #F59E0B, #D97706)",
  cardClassName,
}: Props) {
  if (href) {
    return (
      <motion.div whileHover={{ scale: 1.02 }} className="h-full">
        <Link
          href={href}
          className={`group relative block h-full min-h-[230px] min-w-[180px] overflow-hidden rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-[0_8px_24px_rgba(26,29,35,0.06)] transition-all duration-300 hover:border-amber-300 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_14px_30px_rgba(251,146,60,0.18)] ${cardClassName ?? ""}`}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-25" style={{ background: gradient }} />
          {renderIcon(icon, gradient)}
          <h3 className="relative mb-2 font-[var(--font-heading)] text-[18px] font-bold leading-snug text-[var(--text-primary)]">
            {title}
          </h3>
          <p className="relative font-[var(--font-body)] text-[14px] font-normal leading-[1.5] text-[var(--text-secondary)]">
            {description}
          </p>
        </Link>
      </motion.div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-[#F3E8D8] p-7 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(26,26,46,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_rgba(245,158,11,0.12)] transition-all duration-200 hover:-translate-y-0.5 group ${className}`}>
      {renderIcon(icon, gradient)}
      <h3 className="text-base font-semibold text-[#1A1D23] mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-[#64748B] leading-relaxed">{description}</p>
    </div>
  );
}
