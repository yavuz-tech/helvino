"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
  className?: string;
}

export default function FaqAccordion({ items, className = "" }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className={`max-w-3xl mx-auto divide-y divide-slate-200/80 ${className}`}>
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between py-6 text-left group"
            >
              <span className="text-base font-semibold text-[#0D0D12] group-hover:text-[#4B45FF] transition-colors pr-4">
                {item.question}
              </span>
              <ChevronDown
                className={`w-5 h-5 text-[#8E8EA0] flex-shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-[#4B45FF]" : ""
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                isOpen ? "max-h-96 pb-6" : "max-h-0"
              }`}
            >
              <p className="text-[#5A5B6A] text-sm leading-relaxed">
                {item.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
