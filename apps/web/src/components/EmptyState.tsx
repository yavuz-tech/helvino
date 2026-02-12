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
      <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="text-base font-semibold text-[#1A1D23] mb-1.5">{title}</h3>
      <p className="text-sm text-[#64748B] text-center max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && (onAction || actionHref) && (
        onAction ? (
          <button
            onClick={onAction}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-semibold rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-150 shadow-[0_1px_3px_rgba(245,158,11,0.3)]"
          >
            {actionLabel}
          </button>
        ) : (
          <a
            href={actionHref}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-semibold rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-150 shadow-[0_1px_3px_rgba(245,158,11,0.3)]"
          >
            {actionLabel}
          </a>
        )
      )}
    </div>
  );
}
