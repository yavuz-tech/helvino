import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: string;
  breadcrumb?: React.ReactNode;
  className?: string;
  backButton?: { href: string; label: string };
};

export default function PageHeader({
  title,
  subtitle,
  action,
  badge,
  breadcrumb,
  className = "",
  backButton,
}: Props) {
  return (
    <div className={`mb-8 ${className}`}>
      {backButton && (
        <Link
          href={backButton.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-[#1A1A2E] transition-colors mb-3 group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          {backButton.label}
        </Link>
      )}
      {breadcrumb && (
        <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-500 mb-3">{breadcrumb}</div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold text-amber-900 tracking-tight leading-tight">{title}</h1>
            {badge && (
              <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-sm sm:text-base text-amber-600 leading-relaxed mt-1 max-w-2xl">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
