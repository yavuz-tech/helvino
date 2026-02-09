"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { MessageCircle, X } from "lucide-react";

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
    if (!widgetConnected || hasConversation) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch { /* SSR/privacy mode */ }
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [widgetConnected, hasConversation, delayMs]);

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200/60 ${className}`}>
      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <MessageCircle size={14} className="text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-indigo-800">{t("widget.testChat")}</p>
        <p className="text-[10px] text-indigo-600">{t("widget.testChatDesc")}</p>
      </div>
      <button onClick={dismiss} className="p-0.5 text-indigo-400 hover:text-indigo-600 transition-colors flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}
