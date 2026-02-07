"use client";

/**
 * ErrorBanner – reusable error display with optional requestId traceability.
 *
 * Shows a red error banner with the message.
 * When requestId is provided, displays it below in a smaller, copyable font
 * so that users can reference it when contacting support.
 */

interface ErrorBannerProps {
  message: string;
  requestId?: string | null;
  onDismiss?: () => void;
  className?: string;
}

export default function ErrorBanner({
  message,
  requestId,
  onDismiss,
  className = "",
}: ErrorBannerProps) {
  return (
    <div
      className={`bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 ${className}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm">{message}</p>
          {requestId && (
            <p className="text-xs text-red-500 mt-1 font-mono truncate">
              Request ID: {requestId}
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-600 text-sm font-medium shrink-0"
            aria-label="Dismiss"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
