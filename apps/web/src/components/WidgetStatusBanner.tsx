"use client";

import { useI18n } from "@/i18n/I18nContext";
import { CheckCircle2, Loader2, AlertTriangle, X } from "lucide-react";

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

  const config = {
    loading: {
      bg: "bg-blue-50 border-blue-200/60",
      icon: <Loader2 size={20} className="text-blue-500 animate-spin" />,
      title: t("widget.loading"),
      desc: null,
      titleColor: "text-blue-800",
    },
    ready: {
      bg: "bg-emerald-50 border-emerald-200/60",
      icon: <CheckCircle2 size={20} className="text-emerald-500" />,
      title: t("widget.connected"),
      desc: t("widget.startConversation"),
      titleColor: "text-emerald-800",
    },
    error: {
      bg: "bg-red-50 border-red-200/60",
      icon: <AlertTriangle size={20} className="text-red-500" />,
      title: t("widget.error"),
      desc: t("widget.errorRetry"),
      titleColor: "text-red-800",
    },
  }[status];

  return (
    <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${config.bg} ${className}`}>
      <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center flex-shrink-0 shadow-sm">
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${config.titleColor}`}>{config.title}</p>
        {config.desc && <p className="text-xs text-slate-500 mt-0.5">{config.desc}</p>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-white/50">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
