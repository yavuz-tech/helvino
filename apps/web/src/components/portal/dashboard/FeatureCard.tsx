"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { type ReactNode } from "react";

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  gradient: string;
  cardClassName?: string;
};

export default function FeatureCard({
  icon,
  title,
  description,
  href,
  gradient,
  cardClassName,
}: FeatureCardProps) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="h-full">
      <Link
        href={href}
        className={`group relative block h-full min-h-[230px] min-w-[180px] overflow-hidden rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-[0_8px_24px_rgba(26,29,35,0.06)] transition-all duration-300 hover:border-amber-300 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_14px_30px_rgba(251,146,60,0.18)] ${cardClassName ?? ""}`}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-25" style={{ background: gradient }} />
        <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_8px_20px_rgba(26,29,35,0.14)]" style={{ background: gradient }}>
          <span className="text-[40px] leading-none">{icon}</span>
        </div>
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
