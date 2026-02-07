"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Inbox,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  CreditCard,
  BarChart3,
  Users,
  Puzzle,
  FileText,
  Bell,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { portalApiFetch } from "@/lib/portal-auth";

interface PortalUser {
  email: string;
  role: string;
  orgName: string;
}

interface NavItemDef {
  labelKey: TranslationKey;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const navItemDefs: NavItemDef[] = [
  { labelKey: "nav.overview", href: "/portal", icon: Home },
  { labelKey: "nav.inbox", href: "/portal/inbox", icon: Inbox },
  { labelKey: "nav.widgetSettings", href: "/portal/widget", icon: Puzzle },
  { labelKey: "nav.usage", href: "/portal/usage", icon: BarChart3 },
  { labelKey: "nav.settings", href: "/portal/settings", icon: Settings },
  { labelKey: "nav.security", href: "/portal/security", icon: Shield },
  { labelKey: "nav.billing", href: "/portal/billing", icon: CreditCard },
  { labelKey: "nav.team", href: "/portal/team", icon: Users },
  { labelKey: "nav.auditLogs", href: "/portal/audit", icon: FileText },
];

export default function PortalLayout({
  children,
  user,
  onLogout,
}: {
  children: React.ReactNode;
  user: PortalUser | null;
  onLogout?: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const { t } = useI18n();

  // Poll unread notification count every 30s
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const fetchCount = async () => {
      try {
        const res = await portalApiFetch("/portal/notifications/unread-count");
        if (res.ok && mounted) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {
        // silent
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-slate-900 font-bold text-sm">H</span>
            </div>
            <span className="font-semibold text-sm tracking-wide">
              {t("nav.customerPortal")}
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden hover:bg-slate-800 rounded-lg p-1.5 transition-colors"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {user && (
          <div className="px-6 py-4 border-b border-slate-800">
            <div className="text-xs text-slate-300">{t("portal.organization")}</div>
            <div className="text-sm font-medium truncate">{user.orgName}</div>
            <div className="text-xs text-slate-400">{user.role}</div>
          </div>
        )}

        <nav className="p-4 space-y-1">
          {navItemDefs.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-white text-slate-900"
                    : "text-slate-100 hover:bg-slate-800"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} strokeWidth={2} />
                <span className="text-sm font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden hover:bg-slate-100 rounded-lg p-2"
          >
            <Menu size={20} strokeWidth={2} className="text-slate-600" />
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <Link
              href="/portal/notifications"
              className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title={t("notifications.title")}
            >
              <Bell size={18} strokeWidth={2} className="text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <LanguageSwitcher />
            {user && (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">
                    {user.email}
                  </p>
                  <p className="text-xs text-slate-500">{t("nav.customerPortal")}</p>
                </div>
                <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-slate-600">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title={t("common.logout")}
                  >
                    <LogOut size={16} strokeWidth={2} />
                    <span className="hidden sm:inline">{t("common.logout")}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
