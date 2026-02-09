"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCIES, type Currency } from "@/contexts/CurrencyContext";

export default function CurrencySwitcher() {
  const { currency, setCurrency, config } = useCurrency();
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 transition-all"
        aria-label="Change currency"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-base">{config.symbol}</span>
        <span className="hidden sm:inline uppercase text-xs tracking-wide font-semibold">
          {currency}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select currency"
          className="absolute right-0 top-full mt-1.5 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {Object.entries(CURRENCIES).map(([code, currencyConfig]) => {
            const isActive = currency === code;

            return (
              <button
                key={code}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setCurrency(code as Currency);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-slate-50 text-slate-900 font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">{currencyConfig.symbol}</span>
                <span className="flex-1 text-left font-semibold">{code}</span>
                {isActive && (
                  <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
