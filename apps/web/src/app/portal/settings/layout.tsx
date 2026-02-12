"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import {
  Bell,
  Clock3,
  Database,
  FileText,
  Key,
  Languages,
  MessageSquare,
  Palette,
  Plug,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";

const NAV: Array<{
  href: string;
  key: TranslationKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { href: "/portal/settings", key: "settingsPortal.overview", icon: Settings },
  { href: "/portal/settings/general", key: "settingsPortal.general", icon: SlidersHorizontal },
  { href: "/portal/settings/appearance", key: "settingsPortal.appearance", icon: Palette },
  { href: "/portal/settings/installation", key: "settingsPortal.installation", icon: Plug },
  { href: "/portal/settings/chat-page", key: "settingsPortal.chatPage", icon: MessageSquare },
  { href: "/portal/settings/translations", key: "settingsPortal.translations", icon: Languages },
  { href: "/portal/settings/channels", key: "settingsPortal.channels", icon: Plug },
  { href: "/portal/settings/notifications", key: "settingsPortal.notifications", icon: Bell },
  { href: "/portal/settings/operating-hours", key: "settingsPortal.operatingHours", icon: Clock3 },
  { href: "/portal/settings/macros", key: "settingsPortal.macros", icon: FileText },
  { href: "/portal/settings/workflows", key: "settingsPortal.workflows", icon: Workflow },
  { href: "/portal/settings/sla", key: "settingsPortal.sla", icon: ShieldCheck },
];

const ADVANCED_NAV: Array<{
  href: string;
  key: TranslationKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  pro?: boolean;
}> = [
  { href: "/portal/settings/integrations", key: "settings.integrations", icon: Plug },
  { href: "/portal/settings/api-keys", key: "settings.apiKeys", icon: Key, pro: true },
  { href: "/portal/settings/data", key: "settings.dataManagement", icon: Database },
];

export default function PortalSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-[290px_1fr]">
      {/* ── Sidebar ── */}
      <aside className="h-fit lg:sticky lg:top-24">
        <div
          className="overflow-hidden rounded-2xl shadow-[0_10px_35px_rgba(217,119,6,0.26)]"
          style={{ background: "linear-gradient(180deg, #F59E0B, #D97706)" }}
        >
          <div className="px-[14px] pt-[14px] pb-2">
            <h2
              style={{
                color: "rgba(255,255,255,0.5)",
                fontFamily: "var(--font-heading), var(--font-satoshi), Satoshi, sans-serif",
                textTransform: "uppercase",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.5px",
              }}
            >
              {t("settingsPortal.title")}
            </h2>
          </div>
          <nav className="px-2.5 pb-2.5">
            {NAV.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group mb-1 flex items-center gap-3 rounded-[10px] px-[14px] py-[9px] transition-all duration-150",
                    active
                      ? "bg-white text-[#D97706] shadow-[0_3px_12px_rgba(0,0,0,0.14)]"
                      : "text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.15)] hover:text-white",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] transition-colors",
                      active ? "bg-[#FFF7E8] text-[#D97706]" : "bg-[rgba(255,255,255,0.14)] text-white",
                    ].join(" ")}
                  >
                    <Icon size={16} />
                  </span>
                  <span
                    className={[
                      "flex-1 truncate text-[13.5px] font-[var(--font-body)]",
                      active ? "font-bold text-[#D97706]" : "font-medium",
                    ].join(" ")}
                  >
                    {t(item.key)}
                  </span>
                </Link>
              );
            })}
            <div className="px-[14px] pt-2 pb-1">
              <span
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontFamily: "var(--font-heading), var(--font-satoshi), Satoshi, sans-serif",
                  textTransform: "uppercase",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                }}
              >
                {t("settings.advanced")}
              </span>
            </div>
            {ADVANCED_NAV.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group mb-1 flex items-center gap-3 rounded-[10px] px-[14px] py-[9px] transition-all duration-150",
                    active
                      ? "bg-white text-[#D97706] shadow-[0_3px_12px_rgba(0,0,0,0.14)]"
                      : "text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.15)] hover:text-white",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] transition-colors",
                      active ? "bg-[#FFF7E8] text-[#D97706]" : "bg-[rgba(255,255,255,0.14)] text-white",
                    ].join(" ")}
                  >
                    <Icon size={16} />
                  </span>
                  <span
                    className={[
                      "flex-1 truncate text-[13.5px] font-[var(--font-body)]",
                      active ? "font-bold text-[#D97706]" : "font-medium",
                    ].join(" ")}
                  >
                    {t(item.key)}
                  </span>
                  {item.pro && (
                    <span
                      style={{
                        background: "#FFFFFF",
                        color: "#D97706",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 9,
                        fontWeight: 800,
                        lineHeight: 1.2,
                      }}
                    >
                      PRO
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <section className="min-w-0 pt-2 lg:pt-3">{children}</section>
    </div>
  );
}
