"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import type { TranslationKey } from "@/i18n/translations";
import {
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Bell,
  Clock3,
  Workflow,
  Paintbrush,
} from "lucide-react";

const CARDS: Array<{
  href: string;
  key: TranslationKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { href: "/portal/settings/general", key: "settingsPortal.general", icon: Sparkles },
  { href: "/portal/settings/appearance", key: "settingsPortal.appearance", icon: Paintbrush },
  { href: "/portal/settings/installation", key: "settingsPortal.installation", icon: ArrowRight },
  { href: "/portal/settings/chat-page", key: "settingsPortal.chatPage", icon: Bell },
  { href: "/portal/settings/translations", key: "settingsPortal.translations", icon: ArrowRight },
  { href: "/portal/settings/channels", key: "settingsPortal.channels", icon: ArrowRight },
  { href: "/portal/settings/notifications", key: "settingsPortal.notifications", icon: Bell },
  { href: "/portal/settings/operating-hours", key: "settingsPortal.operatingHours", icon: Clock3 },
  { href: "/portal/settings/macros", key: "settingsPortal.macros", icon: ArrowRight },
  { href: "/portal/settings/workflows", key: "settingsPortal.workflows", icon: Workflow },
  { href: "/portal/settings/sla", key: "settingsPortal.sla", icon: ShieldCheck },
];

export default function PortalSettingsPage() {
  const { t } = useI18n();
  const [issues, setIssues] = useState<Array<{ code: string; severity: "warning" | "error"; message: string }>>([]);
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const errorCount = issues.filter((i) => i.severity === "error").length;

  useEffect(() => {
    portalApiFetch("/portal/settings/consistency")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIssues(data?.issues || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/40 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.title")}</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
            <Sparkles size={12} />
            {t("settingsPortal.manageSection")}
          </span>
        </div>
        <p className="text-sm text-slate-600 mt-1">{t("settingsPortal.subtitle")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("settingsPortal.consistencyChecks")}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{issues.length}</p>
          </div>
          <div className="rounded-xl bg-white border border-amber-200 px-4 py-3">
            <p className="text-xs text-amber-600">{t("usage.warning")}</p>
            <p className="text-xl font-bold text-amber-700 mt-1">{warningCount}</p>
          </div>
          <div className="rounded-xl bg-white border border-red-200 px-4 py-3">
            <p className="text-xs text-red-600">{t("usage.critical")}</p>
            <p className="text-xl font-bold text-red-700 mt-1">{errorCount}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{t(card.key)}</h3>
                <Icon size={15} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <p className="text-xs text-slate-500 mt-1">{t("settingsPortal.manageSection")}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                {t("common.details")}
                <ArrowRight size={13} />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">{t("settingsPortal.consistencyChecks")}</h2>
        {issues.length === 0 ? (
          <p className="text-sm text-emerald-700 inline-flex items-center gap-2">
            <ShieldCheck size={15} />
            {t("settingsPortal.consistencyHealthy")}
          </p>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <p
                key={issue.code}
                className={`text-sm inline-flex items-center gap-2 ${issue.severity === "error" ? "text-red-700" : "text-amber-700"}`}
              >
                <AlertTriangle size={14} />
                {issue.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
