/**
 * FeatureCard — Premium feature showcase card component
 */

import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  className = "",
}: FeatureCardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 p-7 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(26,26,46,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_rgba(26,26,46,0.14)] transition-all duration-200 hover:-translate-y-0.5 group ${className}`}>
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1A1A2E] to-[#2D2D44] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
        <Icon size={22} className="text-white" strokeWidth={2} />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-slate-500 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
