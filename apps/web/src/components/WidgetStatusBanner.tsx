"use client";

import { useI18n } from "@/i18n/I18nContext";

/**
 * WidgetStatusBanner — shows the widget connection status inside the portal.
 *
 * States:
 *   - "loading": widget is loading
 *   - "ready": widget connected successfully (first-run)
 *   - "error": widget failed to load
 *
 * Used in portal overview to give visual feedback on widget health.
 */

type WidgetStatus = "loading" | "ready" | "error";

interface WidgetStatusBannerProps {
  status: WidgetStatus;
  onDismiss?: () => void;
  className?: string;
}

export default function WidgetStatusBanner({
  status,
  onDismiss,
  className = "",
}: WidgetStatusBannerProps) {
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-blue-800">{t("widget.loading")}</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-900">{t("widget.error")}</p>
              <p className="text-xs text-red-700 mt-0.5">{t("widget.errorRetry")}</p>
            </div>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="text-red-400 hover:text-red-600 text-sm ml-3">
              {t("widget.dismiss")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ready
  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-900">{t("widget.connected")}</p>
            <p className="text-xs text-green-700 mt-0.5">{t("widget.startConversation")}</p>
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-green-400 hover:text-green-600 text-sm ml-3">
            {t("widget.dismiss")}
          </button>
        )}
      </div>
    </div>
  );
}
