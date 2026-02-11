"use client";

import { motion } from "framer-motion";

type StatCardProps = {
  emoji: string;
  value: string;
  label: string;
  gradient: string;
  trend?: string;
};

export default function StatCard({ emoji, value, label, gradient, trend }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="relative h-full min-h-[210px] overflow-hidden rounded-3xl border border-white/30 p-6 shadow-[0_12px_36px_rgba(26,29,35,0.14)]"
      style={{ background: gradient }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-sm" />
      <div className="relative z-10">
        <div className="text-[36px] leading-none">{emoji}</div>
        <p className="mt-5 font-[var(--font-heading)] text-[40px] font-bold leading-none text-white tabular-nums">
          {value}
        </p>
        <p className="mt-2 font-[var(--font-body)] text-[15px] font-semibold text-white/90">{label}</p>
        {trend ? (
          <span className="mt-4 inline-flex rounded-full border border-white/35 bg-white/20 px-3 py-1 text-xs font-semibold text-white">
            {trend}
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
