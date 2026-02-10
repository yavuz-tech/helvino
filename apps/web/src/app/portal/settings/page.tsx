"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  Languages,
  MessageSquare,
  Palette,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import type { TranslationKey } from "@/i18n/translations";
import PageHeader from "@/components/ui/PageHeader";
import { p } from "@/styles/theme";

const MODULES: Array<{
  href: string;
  key: TranslationKey;
  descKey: TranslationKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}> = [
  { href: "/portal/settings/general", key: "settingsPortal.general", descKey: "settingsPortal.manageSection", icon: SlidersHorizontal, color: p.iconBlue },
  { href: "/portal/settings/appearance", key: "settingsPortal.appearance", descKey: "settingsPortal.appearanceSubtitle", icon: Palette, color: p.iconViolet },
  { href: "/portal/settings/installation", key: "settingsPortal.installation", descKey: "settingsPortal.installationSubtitle", icon: Plug, color: p.iconIndigo },
  { href: "/portal/settings/chat-page", key: "settingsPortal.chatPage", descKey: "settingsPortal.chatPageSubtitle", icon: MessageSquare, color: p.iconBlue },
  { href: "/portal/settings/translations", key: "settingsPortal.translations", descKey: "settingsPortal.translationsSubtitle", icon: Languages, color: p.iconEmerald },
  { href: "/portal/settings/channels", key: "settingsPortal.channels", descKey: "settingsPortal.channelsSubtitle", icon: Plug, color: p.iconAmber },
  { href: "/portal/settings/notifications", key: "settingsPortal.notifications", descKey: "settingsPortal.notificationsSubtitle", icon: Bell, color: p.iconRose },
  { href: "/portal/settings/operating-hours", key: "settingsPortal.operatingHours", descKey: "settingsPortal.operatingHoursSubtitle", icon: Clock3, color: p.iconEmerald },
  { href: "/portal/settings/macros", key: "settingsPortal.macros", descKey: "settingsPortal.macrosSubtitle", icon: FileText, color: p.iconIndigo },
  { href: "/portal/settings/workflows", key: "settingsPortal.workflows", descKey: "settingsPortal.workflowsSubtitle", icon: Workflow, color: p.iconViolet },
  { href: "/portal/settings/sla", key: "settingsPortal.sla", descKey: "settingsPortal.slaSubtitle", icon: ShieldCheck, color: p.iconAmber },
];

export default function PortalSettingsPage() {
  const { t } = useI18n();
  const [issues, setIssues] = useState<
    Array<{ code: string; severity: "warning" | "error"; message: string }>
  >([]);

  useEffect(() => {
    portalApiFetch("/portal/settings/consistency")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIssues(data?.issues || []))
      .catch(() => {});
  }, []);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;

  return (
    <div className={p.sectionGap}>
      <PageHeader title={t("settingsPortal.title")} subtitle={t("settingsPortal.subtitle")} />

      {/* ── Health Status ── */}
      <div className={`${p.card} overflow-hidden border-violet-200/60`}>
        <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-5 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-violet-700">
            {t("settingsPortal.consistencyChecks")}
          </p>
        </div>
        <div className="px-5 py-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`${p.iconSm} ${
              issues.length === 0 ? p.iconEmerald : errorCount > 0 ? p.iconRose : p.iconAmber
            }`}
          >
            {issues.length === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={p.h3}>
              {issues.length === 0
                ? t("settingsPortal.consistencyHealthy")
                : `${issues.length} ${t("settingsPortal.consistencyChecks")}`}
            </p>
            {issues.length > 0 && (
              <p className={`${p.caption} mt-0.5`}>
                {errorCount > 0 && <span className="text-red-600 font-medium">{errorCount} {t("usage.critical")}</span>}
                {errorCount > 0 && warnCount > 0 && " · "}
                {warnCount > 0 && <span className="text-amber-600 font-medium">{warnCount} {t("usage.warning")}</span>}
              </p>
            )}
          </div>
          {issues.length === 0 && (
            <span className={p.badgeGreen}>
              <CheckCircle2 size={11} />
              {t("common.enabled")}
            </span>
          )}
        </div>
        {issues.length > 0 && (
          <div className={`mt-3 space-y-2 border-t ${p.divider} pt-3`}>
            {issues.map((issue) => (
              <div
                key={issue.code}
                className={`flex items-start gap-2 rounded-xl p-2.5 text-[12px] ${
                  issue.severity === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* ── Module Grid ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link key={mod.href} href={mod.href} className="group">
              <div className={`${p.card} px-5 py-5 ${p.cardHover} flex flex-col h-full`}>
                <div className="flex items-start justify-between">
                  <div className={`${p.iconSm} ${mod.color}`}>
                    <Icon size={15} />
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500"
                  />
                </div>
                <h3 className={`${p.h3} mt-4`}>{t(mod.key)}</h3>
                <p className={`${p.body} mt-1 line-clamp-2 flex-1`}>{t(mod.descKey)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
