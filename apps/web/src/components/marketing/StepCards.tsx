"use client";

import { ReactNode } from "react";

interface Step {
  number: number;
  title: string;
  description: string;
  icon?: ReactNode;
}

interface StepCardsProps {
  steps: Step[];
  className?: string;
}

export default function StepCards({ steps, className = "" }: StepCardsProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(steps.length, 4)} gap-6 ${className}`}>
      {steps.map((step) => (
        <div
          key={step.number}
          className="relative bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(75,69,255,0.08)] transition-all duration-300 hover:-translate-y-0.5 group"
        >
          {/* Step number */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4B45FF] to-[#6C67FF] flex items-center justify-center text-white text-sm font-bold mb-5 shadow-[0_2px_8px_rgba(75,69,255,0.25)]">
            {step.icon || step.number}
          </div>

          <h3 className="text-lg font-semibold text-[#0D0D12] mb-2 tracking-tight">
            {step.title}
          </h3>
          <p className="text-sm text-[#5A5B6A] leading-relaxed">
            {step.description}
          </p>

          {/* Connector line (not on last) */}
          {step.number < steps.length && (
            <div className="hidden lg:block absolute top-14 -right-3 w-6 border-t-2 border-dashed border-[#4B45FF]/20" />
          )}
        </div>
      ))}
    </div>
  );
}
