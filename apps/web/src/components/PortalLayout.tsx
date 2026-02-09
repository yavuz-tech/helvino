"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  CheckCheck,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";

interface NavItemDef {
  labelKey: TranslationKey;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  badge?: "unread"; // inbox only
}

interface NavSectionDef {
  sectionKey: TranslationKey;
  items: NavItemDef[];
}

const navSections: NavSectionDef[] = [
  {
    sectionKey: "nav.section.main",
    items: [
      { labelKey: "nav.overview", href: "/portal", icon: Home },
      { labelKey: "nav.inbox", href: "/portal/inbox", icon: Inbox, badge: "unread" },
      { labelKey: "nav.ai", href: "/portal/ai", icon: Bot },
    ],
  },
  {
    sectionKey: "nav.section.widget",
    items: [
      { labelKey: "nav.widgetSettings", href: "/portal/widget", icon: Puzzle },
      { labelKey: "widgetAppearance.title", href: "/portal/widget-appearance", icon: Paintbrush },
    ],
  },
  {
    sectionKey: "nav.section.insights",
    items: [{ labelKey: "nav.usage", href: "/portal/usage", icon: BarChart3 }],
  },
  {
    sectionKey: "nav.section.general",
    items: [
      { labelKey: "nav.settings", href: "/portal/settings", icon: Settings },
      { labelKey: "nav.security", href: "/portal/security", icon: Shield },
      { labelKey: "nav.team", href: "/portal/team", icon: Users },
      { labelKey: "nav.auditLogs", href: "/portal/audit", icon: FileText },
    ],
  },
  {
    sectionKey: "nav.section.account",
    items: [{ labelKey: "nav.billing", href: "/portal/billing", icon: CreditCard }],
  },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = usePortalAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellPulse, setBellPulse] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  const goToInbox = useCallback((unreadOnly: boolean) => {
    setBellOpen(false);
    router.push(unreadOnly ? "/portal/inbox?unread=1" : "/portal/inbox");
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Pulse bell when new message arrives
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      setBellPulse(true);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setBellPulse(false), 2500);
    };
    window.addEventListener("portal-inbox-badge-pulse", handler);
    return () => {
      window.removeEventListener("portal-inbox-badge-pulse", handler);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Poll inbox unread count; inbox sayfasındayken daha sık yenile (badge takılı kalmasın)
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const fetchCount = async () => {
      try {
        const res = await portalApiFetch(`/portal/conversations/unread-count?_t=${Date.now()}`, { cache: "no-store" });
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
    const pollMs = pathname === "/portal/inbox" ? 5_000 : 30_000;
    const interval = setInterval(fetchCount, pollMs);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("portal-inbox-unread-refresh", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, pathname]);

  // Inbox sayfasına her girildiğinde badge’i hemen yenile
  useEffect(() => {
    if (pathname === "/portal/inbox" && user) {
      window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
    }
  }, [pathname, user]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await portalApiFetch(`/portal/conversations/unread-count?_t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch { /* */ }
  }, []);

  const clearBadge = useCallback(async (onDone?: () => void) => {
    try {
      const res = await portalApiFetch("/portal/conversations/read-all", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setUnreadCount(0);
        window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
        await fetchUnreadCount();
        onDone?.();
      }
    } catch { /* */ }
  }, [fetchUnreadCount]);

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[260px] bg-slate-50/95 border-r border-slate-200/80 shadow-sm transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/80 bg-white/80 shrink-0">
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
          <div className="px-5 py-3 border-b border-slate-200/80 bg-white/60 shrink-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("portal.organization")}</div>
            <div className="text-[13px] font-semibold text-slate-800 truncate mt-0.5">{user.orgName}</div>
          </div>
        )}

        {/* Nav — gruplu, premium (rakip referans) */}
        <nav className="flex-1 overflow-y-auto py-4" style={{ maxHeight: "calc(100vh - 140px)" }}>
          {navSections.map((section) => (
            <div key={section.sectionKey} className="mb-6 last:mb-0">
              <div className="px-5 mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t(section.sectionKey)}
                </span>
              </div>
              <div className="space-y-0.5 px-3">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  const showUnread = item.badge === "unread" && unreadCount > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                        isActive
                          ? "bg-blue-50 text-blue-700 border-l-2 border-blue-500 -ml-px pl-[11px]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-l-2 border-transparent"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="relative flex-shrink-0">
                        <Icon
                          size={18}
                          strokeWidth={isActive ? 2.5 : 2}
                          className={isActive ? "text-blue-600" : "text-slate-500"}
                        />
                        {showUnread && (
                          <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] flex items-center justify-center px-0.5 text-[9px] font-bold text-white bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-sm shadow-red-200/60 ring-1.5 ring-white bell-dot">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </span>
                      <span className="text-[13px] font-medium truncate">{t(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setBellOpen((o) => !o); }}
                className={`relative p-2.5 rounded-xl transition-all duration-300 ${
                  unreadCount > 0
                    ? "bg-blue-50/80 hover:bg-blue-100/80"
                    : "hover:bg-slate-100"
                } ${bellPulse ? "bell-wiggle" : ""}`}
                title={t("inbox.bell.recentMessages")}
                aria-label={t("inbox.bell.recentMessages")}
                aria-expanded={bellOpen}
              >
                <Bell size={18} strokeWidth={2} className={`transition-colors duration-300 ${unreadCount > 0 ? "text-blue-600" : "text-slate-500"}`} />
                {unreadCount > 0 && (
                  <>
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 bell-dot" />
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-sm shadow-red-200/60 ring-2 ring-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  </>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/40 overflow-hidden z-30">
                  {/* Header */}
                  <div className={`px-5 py-4 ${unreadCount > 0 ? "bg-gradient-to-r from-blue-50 to-indigo-50/60 border-b border-blue-100/60" : "bg-slate-50/80 border-b border-slate-100"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${unreadCount > 0 ? "bg-blue-500/10" : "bg-slate-200/60"}`}>
                          <Bell size={15} className={unreadCount > 0 ? "text-blue-600" : "text-slate-400"} />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">
                            {unreadCount > 0
                              ? t("inbox.bell.unreadCount").replace("{count}", String(unreadCount))
                              : t("inbox.bell.noUnread")}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{t("inbox.bell.recentMessages")}</p>
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold text-red-700 bg-red-100 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => goToInbox(unreadCount > 0)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-all duration-150"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Inbox size={14} className="text-slate-500" />
                      </div>
                      {t("nav.inbox")}
                    </button>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearBadge(() => setBellOpen(false)); }}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-blue-700 hover:bg-blue-50 transition-all duration-150"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <CheckCheck size={14} className="text-blue-600" />
                        </div>
                        {t("inbox.markAllRead")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
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
