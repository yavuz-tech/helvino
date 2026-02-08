/**
 * PageHeader — Consistent page header component with title, subtitle, and action slot
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
  backButton?: { href: string; label: string };
}

export default function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
  className = "",
  backButton,
}: PageHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      {backButton && (
        <Link
          href={backButton.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#1A1A2E] transition-colors mb-3 group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          {backButton.label}
        </Link>
      )}
      {breadcrumb && (
        <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
          {breadcrumb}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed mt-1 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
