"use client";

import { ReactNode } from "react";

interface SectionShowcaseProps {
  overline?: string;
  title: string;
  description?: string;
  children: ReactNode;
  /** Dark section (hero-style bg) */
  dark?: boolean;
  /** Center-align text */
  centered?: boolean;
  className?: string;
  id?: string;
}

export default function SectionShowcase({
  overline,
  title,
  description,
  children,
  dark = false,
  centered = true,
  className = "",
  id,
}: SectionShowcaseProps) {
  return (
    <section
      id={id}
      className={`py-20 sm:py-28 ${
        dark
          ? "bg-gradient-to-b from-[#0D0D12] via-[#13131A] to-[#1A1A2E] text-white"
          : "bg-white"
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className={centered ? "text-center max-w-3xl mx-auto mb-16" : "mb-16"}>
          {overline && (
            <span
              className={`inline-block text-[11px] font-bold uppercase tracking-[0.12em] mb-4 px-3 py-1 rounded-full ${
                dark
                  ? "bg-[#4B45FF]/15 text-[#6C67FF]"
                  : "bg-[#EDEDFF] text-[#4B45FF]"
              }`}
            >
              {overline}
            </span>
          )}
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
        </div>

        {/* Content */}
        {children}
      </div>
    </section>
  );
}
