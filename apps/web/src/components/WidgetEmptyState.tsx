"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";

/**
 * WidgetEmptyState — contextual empty states for widget-related scenarios.
 *
 * Variants:
 *   "not-loaded": widget hasn't been embedded yet
 *   "error": widget failed to connect
 *   "domain-not-authorized": referer domain not in allowlist
 */

type Variant = "not-loaded" | "error" | "domain-not-authorized";

interface WidgetEmptyStateProps {
  variant: Variant;
  onRetry?: () => void;
  onCopySnippet?: () => void;
  className?: string;
}

export default function WidgetEmptyState({
  variant,
  onRetry,
  onCopySnippet,
  className = "",
}: WidgetEmptyStateProps) {
  const { t } = useI18n();

  const configs: Record<Variant, {
    icon: React.ReactNode;
    title: string;
    desc: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
  }> = {
    "not-loaded": {
      icon: (
        <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      title: t("widget.notLoaded"),
      desc: t("widget.notLoadedDesc"),
      actionLabel: t("embed.copySnippet"),
      onAction: onCopySnippet,
    },
    error: {
      icon: (
        <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      title: t("widget.error"),
      desc: t("widget.errorRetry"),
      actionLabel: onRetry ? t("common.retry") : undefined,
      onAction: onRetry,
    },
    "domain-not-authorized": {
      icon: (
        <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      title: t("widget.domainNotAuth"),
      desc: t("widget.domainNotAuthDesc"),
      actionLabel: t("embed.configureDomains"),
      actionHref: "/portal/security",
    },
  };

  const cfg = configs[variant];

  return (
    <div className={`flex flex-col items-center justify-center py-10 px-6 ${className}`}>
      <div className="mb-4">{cfg.icon}</div>
      <h3 className="text-base font-semibold text-amber-900 mb-1">{cfg.title}</h3>
      <p className="text-sm text-amber-600 text-center max-w-sm mb-5 leading-relaxed">
        {cfg.desc}
      </p>
      {cfg.actionLabel && cfg.onAction && (
        <button
          onClick={cfg.onAction}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors"
        >
          {cfg.actionLabel}
        </button>
      )}
      {cfg.actionLabel && cfg.actionHref && !cfg.onAction && (
        <Link
          href={cfg.actionHref}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors"
        >
          {cfg.actionLabel}
        </Link>
      )}
    </div>
  );
}
