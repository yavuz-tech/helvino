"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import {
  Settings,
  SlidersHorizontal,
  Palette,
  Plug,
  MessageSquare,
  Languages,
  Bell,
  Clock3,
  FileText,
  Workflow,
  ShieldCheck,
} from "lucide-react";

const SETTINGS_ITEMS: Array<{
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

export default function PortalSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <aside className="bg-white border border-slate-200 rounded-2xl p-3 h-fit lg:sticky lg:top-24 shadow-sm">
        <h2 className="px-3 pt-2 pb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          {t("settingsPortal.title")}
        </h2>
        <nav className="space-y-1 max-h-[72vh] overflow-y-auto pr-1">
          {SETTINGS_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all ${
                  active
                    ? "bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={16} className={active ? "text-blue-600" : "text-slate-400"} />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <section>{children}</section>
    </div>
  );
}
