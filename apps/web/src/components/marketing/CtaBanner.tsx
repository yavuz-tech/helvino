"use client";

import Link from "next/link";

interface CtaBannerProps {
  title: string;
  description?: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  /** Dark variant (indigo gradient bg) */
  dark?: boolean;
  className?: string;
}

export default function CtaBanner({
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  dark = true,
  className = "",
}: CtaBannerProps) {
  return (
    <section
      className={`py-20 sm:py-28 ${
        dark
          ? "bg-gradient-to-br from-[#0D0D12] via-[#13131A] to-[#1A1A2E]"
          : "bg-[#F7F8FA]"
      } ${className}`}
    >
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2
          className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.12] ${
            dark ? "text-white" : "text-[#0D0D12]"
          }`}
        >
          {title}
        </h2>
        {description && (
          <p
            className={`mt-5 text-lg leading-relaxed ${
              dark ? "text-slate-400" : "text-[#5A5B6A]"
            }`}
          >
            {description}
          </p>
        )}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-xl bg-gradient-to-r from-[#0F5C5C] to-[#1E88A8] hover:from-[#0D4F4F] hover:to-[#0F5C5C] shadow-[0_2px_12px_rgba(75,69,255,0.35)] hover:shadow-[0_6px_20px_rgba(75,69,255,0.4)] transition-all duration-200 hover:-translate-y-0.5"
          >
            {primaryLabel}
            <span className="text-white/80">→</span>
          </Link>
          {secondaryLabel && secondaryHref && (
            <Link
              href={secondaryHref}
              className={`inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl border transition-all duration-200 hover:-translate-y-0.5 ${
                dark
                  ? "text-white border-slate-600 hover:border-slate-400 hover:bg-white/5"
                  : "text-[#0D0D12] border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
