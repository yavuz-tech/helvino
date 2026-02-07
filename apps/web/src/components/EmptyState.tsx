"use client";

/**
 * EmptyState — reusable empty state component for lists/sections.
 *
 * Props:
 *   icon: emoji or text icon
 *   title: what this section is
 *   description: why it's empty + what to do
 *   actionLabel: CTA button text (optional)
 *   actionHref: CTA link target (optional)
 *   onAction: CTA click handler (optional, takes priority over href)
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
    <div className={`flex flex-col items-center justify-center py-12 px-6 ${className}`}>
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && (onAction || actionHref) && (
        onAction ? (
          <button
            onClick={onAction}
            className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            {actionLabel}
          </button>
        ) : (
          <a
            href={actionHref}
            className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors inline-block"
          >
            {actionLabel}
          </a>
        )
      )}
    </div>
  );
}
