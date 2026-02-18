"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";

function HelvionMark({ height = 20 }: { height?: number }) {
  const iconW = (42 / 48) * height;
  const wordSize = Math.round(height * 0.62);

  return (
    <span className="inline-flex items-center whitespace-nowrap" style={{ gap: 6 }}>
      <svg
        width={iconW}
        height={height}
        viewBox="0 0 42 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
        style={{ display: "block" }}
      >
        <path
          d="M3.6 19.2C3.6 12.572 8.972 7.2 15.6 7.2H20.4C27.028 7.2 32.4 12.572 32.4 19.2V21.6C32.4 28.228 27.028 33.6 20.4 33.6H16.8L9.6 39V33.6C6.3 31.5 3.6 27.6 3.6 24V19.2Z"
          fill="#FBBF24"
        />
        <path
          d="M20.4 19.2C20.4 13.898 24.698 9.6 30 9.6H32.4C37.702 9.6 42 13.898 42 19.2V21.6C42 26.902 37.702 31.2 32.4 31.2H30L25.2 34.8V31.32C22.56 29.76 20.4 26.7 20.4 24V19.2Z"
          fill="#D97706"
        />
      </svg>
      <span
        style={{
          fontFamily: "Manrope, system-ui, -apple-system, sans-serif",
          fontSize: wordSize,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#0C0A09",
          lineHeight: 1,
        }}
      >
        Helvion<span style={{ color: "#F59E0B" }}>.</span>
      </span>
    </span>
  );
}

export default function HelvionPoweredByPill({
  href = "https://helvion.io",
  prefixKey = "widgetPreview.poweredByPrefix",
  suffixKey = "widgetPreview.poweredBySuffix",
  markHeight = 20,
  barClassName = "",
  pillClassName = "",
  textClassName = "",
}: {
  href?: string;
  prefixKey?: TranslationKey;
  suffixKey?: TranslationKey;
  markHeight?: number;
  barClassName?: string;
  pillClassName?: string;
  textClassName?: string;
}) {
  const { t } = useI18n();

  const prefix = useMemo(() => String(t(prefixKey) || "").trim(), [t, prefixKey]);
  const suffix = useMemo(() => String(t(suffixKey) || "").trim(), [t, suffixKey]);

  const hasPrefix = prefix.length > 0;
  const hasSuffix = suffix.length > 0;

  return (
    <div
      className={`flex items-center justify-center border-t border-[#EBEBED] bg-[#FAFAFA] px-3 py-2.5 ${barClassName}`}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Helvion"
        className={`inline-flex items-center rounded-full border border-black/5 bg-white/85 px-2.5 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${pillClassName}`}
        style={{ gap: 4 }}
      >
        <span
          className={`inline-flex items-center whitespace-nowrap text-[11.5px] font-bold tracking-[0.005em] text-[#78716C] ${textClassName}`}
          style={{ gap: 4, fontFamily: "system-ui, -apple-system, sans-serif" }}
        >
          {hasPrefix ? <span>{prefix}</span> : null}
          <HelvionMark height={markHeight} />
          {hasSuffix ? <span>{suffix}</span> : null}
        </span>
      </a>
    </div>
  );
}

