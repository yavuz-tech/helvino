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
  Paintbrush,
  Bot,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";

interface NavItemDef {
  labelKey: TranslationKey;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const navItemDefs: NavItemDef[] = [
  { labelKey: "nav.overview", href: "/portal", icon: Home },
  { labelKey: "nav.inbox", href: "/portal/inbox", icon: Inbox },
  { labelKey: "nav.ai", href: "/portal/ai", icon: Bot },
  { labelKey: "nav.widgetSettings", href: "/portal/widget", icon: Puzzle },
  { labelKey: "widgetAppearance.title", href: "/portal/widget-appearance", icon: Paintbrush },
  { labelKey: "nav.usage", href: "/portal/usage", icon: BarChart3 },
  { labelKey: "nav.settings", href: "/portal/settings", icon: Settings },
  { labelKey: "nav.security", href: "/portal/security", icon: Shield },
  { labelKey: "nav.billing", href: "/portal/billing", icon: CreditCard },
  { labelKey: "nav.team", href: "/portal/team", icon: Users },
  { labelKey: "nav.auditLogs", href: "/portal/audit", icon: FileText },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = usePortalAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const { t } = useI18n();

  // Poll inbox unread count every 30s and refetch when new message arrives (Socket event)
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const fetchCount = async () => {
      try {
        // cache: no-store so opening a conversation immediately reflects in the bell badge
        const res = await portalApiFetch("/portal/conversations/unread-count", { cache: "no-store" });
        if (res.ok && mounted) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {
        // silent
      }
    };

    const onRefresh = () => { if (mounted) fetchCount(); };
    const onVisible = () => { if (document.visibilityState === "visible" && mounted) fetchCount(); };
    window.addEventListener("portal-inbox-unread-refresh", onRefresh);
    document.addEventListener("visibilitychange", onVisible);

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("portal-inbox-unread-refresh", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
        className={`fixed top-0 left-0 z-50 h-full w-[260px] bg-white border-r border-slate-200/80 shadow-sm transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1A1A2E] to-[#2D2D44] rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">H</span>
            </div>
            <span className="font-semibold text-[13px] text-slate-900 tracking-tight">
              {t("nav.customerPortal")}
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden hover:bg-slate-100 rounded-lg p-1.5 transition-colors"
          >
            <X size={18} strokeWidth={2} className="text-slate-400" />
          </button>
        </div>

        {/* Org info */}
        {user && (
          <div className="px-5 py-3 border-b border-slate-200/80 bg-slate-50/50">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("portal.organization")}</div>
            <div className="text-[13px] font-semibold text-slate-800 truncate mt-0.5">{user.orgName}</div>
          </div>
        )}

        {/* Nav */}
        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
          {navItemDefs.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 ${
                  isActive
                    ? "bg-gradient-to-r from-[#1A1A2E] to-[#2D2D44] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[13px] font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-[260px]">
        {/* Top bar */}
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-5 sticky top-0 z-20 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden hover:bg-slate-100 rounded-lg p-2 transition-colors"
          >
            <Menu size={20} strokeWidth={2} className="text-slate-400" />
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <Link
              href="/portal/inbox"
              className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title={t("inbox.bell.recentMessages")}
              aria-label={t("inbox.bell.recentMessages")}
            >
              <Bell size={17} strokeWidth={2} className="text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] flex items-center justify-center px-1 text-[9px] font-bold text-white bg-red-500 rounded-full shadow-sm">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <LanguageSwitcher />
            {user && (
              <>
                <div className="hidden sm:block text-right mr-1">
                  <p className="text-[13px] font-semibold text-slate-800 leading-tight">
                    {user.email}
                  </p>
                  <p className="text-[11px] text-slate-500">{user.role}</p>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-xs font-bold text-slate-600">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all duration-150"
                  title={t("common.logout")}
                >
                  <LogOut size={15} strokeWidth={2} />
                  <span className="hidden sm:inline font-medium">{t("common.logout")}</span>
                </button>
              </>
            )}
          </div>
        </header>

        {pathname === "/portal/inbox" ? (
          <>{children}</>
        ) : (
          <main className="p-5 sm:p-6">{children}</main>
        )}
      </div>
    </div>
  );
}
