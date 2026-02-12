"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { LOCALES, LOCALE_META, type Locale } from "@/i18n/translations";

// Inline SVG flags — clean, crisp, same dimensions, no external deps
function FlagEN() {
  return (
    <svg viewBox="0 0 60 40" width="20" height="13" className="rounded-[2px] shrink-0" aria-hidden="true">
      <rect width="60" height="40" fill="#012169"/>
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8"/>
      <path d="M0,0 L30,20" stroke="#C8102E" strokeWidth="4"/>
      <path d="M60,0 L30,20" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30,20 L60,40" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30,20 L0,40" stroke="#C8102E" strokeWidth="4"/>
      <rect x="25" width="10" height="40" fill="#fff"/>
      <rect y="15" width="60" height="10" fill="#fff"/>
      <rect x="27" width="6" height="40" fill="#C8102E"/>
      <rect y="17" width="60" height="6" fill="#C8102E"/>
    </svg>
  );
}

function FlagTR() {
  return (
    <svg viewBox="0 0 60 40" width="20" height="13" className="rounded-[2px] shrink-0" aria-hidden="true">
      <rect width="60" height="40" fill="#E30A17"/>
      <circle cx="21" cy="20" r="12" fill="#fff"/>
      <circle cx="24" cy="20" r="9.6" fill="#E30A17"/>
      <polygon points="34,20 27,16.5 27,23.5" fill="#fff" transform="rotate(18,34,20)"/>
    </svg>
  );
}

function FlagES() {
  return (
    <svg viewBox="0 0 60 40" width="20" height="13" className="rounded-[2px] shrink-0" aria-hidden="true">
      <rect width="60" height="40" fill="#AA151B"/>
      <rect y="10" width="60" height="20" fill="#F1BF00"/>
    </svg>
  );
}

const FLAG_COMPONENTS: Record<Locale, React.FC> = {
  en: FlagEN,
  tr: FlagTR,
  es: FlagES,
};

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [open]);

  const CurrentFlag = FLAG_COMPONENTS[locale];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center gap-1.5 rounded-xl border border-[#F3E8D8] bg-[#FFFBF5]/50 px-3.5 text-sm font-semibold text-[#1A1D23] transition-all hover:bg-amber-50/70 hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:ring-offset-1"
        aria-label="Change language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <CurrentFlag />
        <span className="hidden font-[var(--font-heading)] text-[13px] font-semibold uppercase tracking-wide sm:inline">
          {locale}
        </span>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={`text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-[#F3E8D8] rounded-lg shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {LOCALES.map((loc) => {
            const meta = LOCALE_META[loc];
            const Flag = FLAG_COMPONENTS[loc];
            const isActive = locale === loc;

            return (
              <button
                key={loc}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setLocale(loc);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-amber-50 text-amber-900 font-medium"
                    : "text-amber-800 hover:bg-[#FFFBF5]"
                }`}
              >
                <Flag />
                <span className="flex-1 text-left">{meta.nativeName}</span>
                {isActive && (
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
