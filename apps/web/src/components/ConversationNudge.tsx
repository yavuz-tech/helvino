"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";

/**
 * ConversationNudge — soft conversion nudge that appears after the widget
 * has been embedded but no conversation has been started yet.
 *
 * Shows a dismissible banner after `delayMs` milliseconds.
 * Persists dismissal in sessionStorage so it doesn't reappear in the same session.
 */

interface ConversationNudgeProps {
  widgetConnected: boolean;
  hasConversation: boolean;
  delayMs?: number;
  className?: string;
}

const DISMISS_KEY = "helvino_conv_nudge_dismissed";

export default function ConversationNudge({
  widgetConnected,
  hasConversation,
  delayMs = 5000,
  className = "",
}: ConversationNudgeProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if conditions aren't met
    if (!widgetConnected || hasConversation) return;

    // Don't show if already dismissed
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch { /* SSR/privacy mode */ }

    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [widgetConnected, hasConversation, delayMs]);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <div className={`bg-indigo-50 border border-indigo-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-indigo-900">{t("widget.testChat")}</p>
            <p className="text-xs text-indigo-700 mt-0.5">{t("widget.testChatDesc")}</p>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-indigo-400 hover:text-indigo-600 text-sm font-medium ml-3 flex-shrink-0"
        >
          {t("widget.dismiss")}
        </button>
      </div>
    </div>
  );
}
