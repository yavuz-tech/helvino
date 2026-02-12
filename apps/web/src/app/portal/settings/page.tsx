"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Database,
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  KeyRound,
  Languages,
  Link2,
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
  { href: "/portal/settings/integrations", key: "settings.integrations", descKey: "settings.integrations.desc", icon: Link2, color: p.iconBlue },
  { href: "/portal/settings/api-keys", key: "settings.apiKeys", descKey: "settings.apiKeys.desc", icon: KeyRound, color: p.iconAmber },
  { href: "/portal/settings/data", key: "settings.dataManagement", descKey: "settings.dataManagement.desc", icon: Database, color: p.iconEmerald },
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
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader title={t("settingsPortal.title")} subtitle={t("settingsPortal.subtitle")} />

      {/* ── Health Status ── */}
      <div
        className="overflow-hidden"
        style={{
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
          animation: "settingsFadeUp .5s ease 0s both",
        }}
      >
        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid #F3E8D8" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "#94A3B8",
              fontFamily: "var(--font-manrope), Manrope, sans-serif",
            }}
          >
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
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1A1D23",
                  fontFamily: "var(--font-manrope), Manrope, sans-serif",
                }}
              >
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
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  background: "#ECFDF5",
                  color: "#059669",
                  borderRadius: 999,
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--font-manrope), Manrope, sans-serif",
                }}
              >
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
              <div
                className="flex flex-col h-full"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #F3E8D8",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
                  transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
                  animation: `settingsFadeUp .5s ease ${0.05 + MODULES.indexOf(mod) * 0.05}s both`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = "#E8D5BC";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)";
                  e.currentTarget.style.borderColor = "#F3E8D8";
                }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={mod.color}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon size={15} />
                  </div>
                  <ArrowRight
                    size={14}
                    className="transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-amber-500"
                    style={{ color: "#94A3B8" }}
                  />
                </div>
                <h3
                  className="mt-4"
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1A1D23",
                    fontFamily: "var(--font-satoshi), Satoshi, sans-serif",
                  }}
                >
                  {t(mod.key)}
                  {mod.key === "settings.apiKeys" && (
                    <span
                      style={{
                        marginLeft: 8,
                        background: "linear-gradient(135deg, #F59E0B, #D97706)",
                        color: "#fff",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        verticalAlign: "middle",
                      }}
                    >
                      PRO
                    </span>
                  )}
                </h3>
                <p
                  className="mt-1 line-clamp-2 flex-1"
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#64748B",
                    fontFamily: "var(--font-manrope), Manrope, sans-serif",
                  }}
                >
                  {t(mod.descKey)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      <style jsx global>{`
        @keyframes settingsFadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
