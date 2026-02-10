"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { p } from "@/styles/theme";
import {
  Bell,
  ChevronRight,
  Clock3,
  FileText,
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
  color: string;
}> = [
  { href: "/portal/settings", key: "settingsPortal.overview", icon: Settings, color: p.iconSlate },
  { href: "/portal/settings/general", key: "settingsPortal.general", icon: SlidersHorizontal, color: p.iconBlue },
  { href: "/portal/settings/appearance", key: "settingsPortal.appearance", icon: Palette, color: p.iconViolet },
  { href: "/portal/settings/installation", key: "settingsPortal.installation", icon: Plug, color: p.iconIndigo },
  { href: "/portal/settings/chat-page", key: "settingsPortal.chatPage", icon: MessageSquare, color: p.iconBlue },
  { href: "/portal/settings/translations", key: "settingsPortal.translations", icon: Languages, color: p.iconEmerald },
  { href: "/portal/settings/channels", key: "settingsPortal.channels", icon: Plug, color: p.iconAmber },
  { href: "/portal/settings/notifications", key: "settingsPortal.notifications", icon: Bell, color: p.iconRose },
  { href: "/portal/settings/operating-hours", key: "settingsPortal.operatingHours", icon: Clock3, color: p.iconEmerald },
  { href: "/portal/settings/macros", key: "settingsPortal.macros", icon: FileText, color: p.iconIndigo },
  { href: "/portal/settings/workflows", key: "settingsPortal.workflows", icon: Workflow, color: p.iconViolet },
  { href: "/portal/settings/sla", key: "settingsPortal.sla", icon: ShieldCheck, color: p.iconAmber },
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
        <div className={`${p.card} overflow-hidden border-violet-200/60 shadow-[0_10px_35px_rgba(109,40,217,0.10)]`}>
          <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-5 py-4">
            <h2 className={p.h3}>{t("settingsPortal.title")}</h2>
          </div>
          <nav className="p-2.5">
            {NAV.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-150",
                    active
                      ? "bg-gradient-to-r from-violet-700 to-fuchsia-700 text-white shadow-[0_8px_24px_rgba(109,40,217,0.25)]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                  ].join(" ")}
                >
                  <span
                    className={[
                      p.iconSm,
                      active ? "bg-white/10 text-white" : item.color,
                    ].join(" ")}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="flex-1 truncate">{t(item.key)}</span>
                  {active && <ChevronRight size={14} className="opacity-60" />}
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
