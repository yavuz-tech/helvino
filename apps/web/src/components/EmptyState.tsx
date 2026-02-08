"use client";

/**
 * EmptyState — Premium empty state component for lists/sections.
 */

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && (onAction || actionHref) && (
        onAction ? (
          <button
            onClick={onAction}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-[#1A1A2E] text-white text-sm font-semibold rounded-xl hover:bg-[#15152A] transition-all duration-150 shadow-[0_1px_3px_rgba(26,26,46,0.2)]"
          >
            {actionLabel}
          </button>
        ) : (
          <a
            href={actionHref}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-[#1A1A2E] text-white text-sm font-semibold rounded-xl hover:bg-[#15152A] transition-all duration-150 shadow-[0_1px_3px_rgba(26,26,46,0.2)]"
          >
            {actionLabel}
          </a>
        )
      )}
    </div>
  );
}
