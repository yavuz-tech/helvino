"use client";

import Link from "next/link";

type AlertBannerProps = {
  icon: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
};

export default function AlertBanner({ icon, title, message, ctaLabel, ctaHref }: AlertBannerProps) {
  return (
    <div
      className="rounded-3xl border border-amber-200/80 p-5 shadow-[0_10px_30px_rgba(245,158,11,0.16)]"
      style={{ background: "linear-gradient(135deg, #FFFBEB, #FFF7ED)" }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-[0_8px_20px_rgba(245,158,11,0.25)]"
            style={{ background: "linear-gradient(135deg, #FDB462, #F59E0B)" }}
          >
            {icon}
          </div>
          <div>
            <p className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--text-primary)]">{title}</p>
            <p className="mt-1 font-[var(--font-body)] text-[14px] text-[var(--text-secondary)]">{message}</p>
          </div>
        </div>

        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-[var(--font-body)] text-sm font-semibold text-white shadow-[0_8px_20px_rgba(251,146,60,0.35)] transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #F59E0B, #FB923C)" }}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
