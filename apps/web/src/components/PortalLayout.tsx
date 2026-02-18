"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Inbox,
  LogOut,
  Menu,
  X,
  Bell,
  CheckCheck,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { portalApiFetch } from "@/lib/portal-auth";
import { mountPublicWidgetScript, rememberPublicWidgetIdentity } from "@/lib/public-widget";
import { colors, fonts, shadow, radius, ui } from "@/lib/design-tokens";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { usePortalInboxNotification } from "@/contexts/PortalInboxNotificationContext";
import CampaignTopBanner from "@/components/CampaignTopBanner";
import { bubbleBorderRadius, resolveWidgetBubbleTheme } from "@helvino/shared";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getDeployEnv } from "@/lib/runtime-env";

interface WidgetBubbleSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  bubbleShape?: "circle" | "rounded-square";
  bubbleIcon?: "chat" | "message" | "help" | "custom";
  bubbleSize?: number;
  bubblePosition?: "bottom-right" | "bottom-left";
  greetingText?: string;
  greetingEnabled?: boolean;
  welcomeTitle: string;
}

interface NavItemDef {
  labelKey: TranslationKey;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: "unread"; // inbox only
  roles?: Array<"owner" | "admin">;
}

interface NavSectionDef {
  sectionKey: TranslationKey;
  items: NavItemDef[];
}

function OverviewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path d="M5 12v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" fill="var(--icon-bg)" />
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path d="M2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11L2 12z" fill="var(--icon-bg)" />
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AiBotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="10" rx="2" fill="var(--icon-bg)" />
      <rect x="3" y="11" width="18" height="10" rx="2" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <circle cx="12" cy="5" r="2" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <path d="M12 7v4" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8.5" cy="16" r="1.5" fill="var(--icon-stroke)" />
      <circle cx="15.5" cy="16" r="1.5" fill="var(--icon-stroke)" />
    </svg>
  );
}

function WidgetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="var(--icon-stroke)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
    </svg>
  );
}

function WidgetAppearanceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <circle cx="8" cy="8" r="1.5" fill="var(--icon-stroke)" />
      <circle cx="14" cy="7" r="1.5" fill="var(--icon-stroke)" />
      <circle cx="17" cy="11" r="1.5" fill="var(--icon-stroke)" />
      <circle cx="7" cy="13" r="1.5" fill="var(--icon-stroke)" />
    </svg>
  );
}

function UsageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="13" width="4" height="8" rx="1" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <rect x="10" y="3" width="4" height="18" rx="1" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <rect x="16" y="8" width="4" height="13" rx="1" fill="var(--icon-stroke)" stroke="var(--icon-stroke)" strokeWidth="1.8" opacity="0.8" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SecurityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9 12 11 14 15 10" stroke="var(--icon-stroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="4" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <path d="M1 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="8" r="3" stroke="var(--icon-stroke)" strokeWidth="1.5" strokeDasharray="2 2" />
      <path d="M21 21v-1.5a3 3 0 0 0-2-2.83" stroke="var(--icon-stroke)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AuditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="18" rx="2" fill="var(--icon-bg)" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="8" y="2" width="8" height="4" rx="1" fill="var(--icon-stroke)" stroke="var(--icon-stroke)" strokeWidth="1" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="16" x2="12" y2="16" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="4" width="22" height="16" rx="2" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <rect x="1" y="8" width="22" height="4" fill="var(--icon-stroke)" opacity="0.3" />
      <line x1="1" y1="10" x2="23" y2="10" stroke="var(--icon-stroke)" strokeWidth="1.8" />
    </svg>
  );
}

function PricingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="var(--icon-bg)" stroke="var(--icon-stroke)" strokeWidth="1.8" />
      <path d="M12 7v10" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 9.5c0-1.1-1.34-2-3-2s-3 .9-3 2 1.34 2 3 2 3 .9 3 2-1.34 2-3 2-3-.9-3-2" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const navSections: NavSectionDef[] = [
  {
    sectionKey: "nav.section.main",
    items: [
      { labelKey: "nav.overview", href: "/portal", icon: OverviewIcon },
      { labelKey: "nav.inbox", href: "/portal/inbox", icon: InboxIcon, badge: "unread" },
      { labelKey: "nav.ai", href: "/portal/ai", icon: AiBotIcon },
    ],
  },
  {
    sectionKey: "nav.section.widget",
    items: [
      { labelKey: "nav.widgetSettings", href: "/portal/widget", icon: WidgetIcon },
      { labelKey: "widgetAppearance.title", href: "/portal/widget-appearance", icon: WidgetAppearanceIcon },
    ],
  },
  {
    sectionKey: "nav.section.insights",
    items: [{ labelKey: "nav.usage", href: "/portal/usage", icon: UsageIcon }],
  },
  {
    sectionKey: "nav.section.general",
    items: [
      { labelKey: "nav.settings", href: "/portal/settings", icon: SettingsIcon },
      { labelKey: "nav.security", href: "/portal/security", icon: SecurityIcon },
      { labelKey: "nav.team", href: "/portal/team", icon: TeamIcon },
      { labelKey: "nav.auditLogs", href: "/portal/audit", icon: AuditIcon },
    ],
  },
  {
    sectionKey: "nav.section.account",
    items: [
      { labelKey: "nav.billing", href: "/portal/billing", icon: BillingIcon },
      { labelKey: "nav.pricing", href: "/portal/pricing", icon: PricingIcon },
    ],
  },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  void shadow;
  void radius;
  void ui;
  void fonts;
  const { user, logout } = usePortalAuth();
  const { unreadMap } = usePortalInboxNotification();
  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + (Number(b) || 0), 0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPlanKey, setCurrentPlanKey] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [widgetSettings, setWidgetSettings] = useState<WidgetBubbleSettings | null>(null);
  const [bubbleHover, setBubbleHover] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const userRole = user?.role?.toLowerCase() || "";
  const userAvatarUrl = (user as { avatarUrl?: string } | null)?.avatarUrl;
  const userName = (user as { name?: string } | null)?.name;
  const avatarLetter = (userName?.charAt(0) || user?.email?.charAt(0) || "U").toUpperCase();
  const normalizedPlanKey = (currentPlanKey || "").trim().toLowerCase();
  const showSidebarUpgradeCta = normalizedPlanKey === "free";
  const deployEnv = getDeployEnv();

  const fetchWidgetSettings = useCallback(async () => {
    try {
      const res = await portalApiFetch(`/portal/widget/settings?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.settings) setWidgetSettings(data.settings as WidgetBubbleSettings);
    } catch {
      // silent
    }
  }, []);

  const syncPublicWidgetIdentity = useCallback(async () => {
    try {
      const res = await portalApiFetch(`/portal/widget/config?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const siteId = data?.embedSnippet?.siteId;
      if (siteId) {
        rememberPublicWidgetIdentity({ siteId });
        mountPublicWidgetScript({ siteId });
      }
    } catch (err: any) {
      // Silent: public widget is optional; avoid console noise in production.
    }
  }, []);

  const goToInbox = useCallback((unreadOnly: boolean) => {
    setBellOpen(false);
    router.push(unreadOnly ? "/portal/inbox?unread=1" : "/portal/inbox");
  }, [router]);

  // Fetch widget appearance settings for the floating bubble
  useEffect(() => {
    if (!user) return;
    fetchWidgetSettings();
    syncPublicWidgetIdentity();
  }, [user, fetchWidgetSettings, syncPublicWidgetIdentity]);

  // Refresh widget settings when user customizes them
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ settings?: WidgetBubbleSettings }>;
      if (custom.detail?.settings) {
        setWidgetSettings(custom.detail.settings);
      }
      fetchWidgetSettings();
      syncPublicWidgetIdentity();
    };
    window.addEventListener("widget-settings-updated", handler as EventListener);
    return () => window.removeEventListener("widget-settings-updated", handler as EventListener);
  }, [fetchWidgetSettings, syncPublicWidgetIdentity]);

  // Live preview sync from widget appearance editor (no API roundtrip)
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ settings?: WidgetBubbleSettings }>;
      if (custom.detail?.settings) {
        setWidgetSettings(custom.detail.settings);
      }
    };
    window.addEventListener("widget-settings-live-preview", handler as EventListener);
    return () => window.removeEventListener("widget-settings-live-preview", handler as EventListener);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // No sidebar flashing; badge only.

  // Keep sidebar upgrade card aligned with actual plan.
  // Pro+ users should only see upgrade prompts on locked higher-tier screens.
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const fetchPlan = async () => {
      try {
        const res = await portalApiFetch(`/portal/billing/status?_t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok || !mounted) return;
        const data = await res.json();
        const key = String(data?.plan?.key || data?.org?.planKey || "").trim().toLowerCase();
        if (key && mounted) {
          setCurrentPlanKey(key);
        }
      } catch {
        // silent
      }
    };

    fetchPlan();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("sidebar-collapsed");
      if (saved === "1") setSidebarOpen(false);
    } catch {
      // no-op
    }
  }, []);

  const toggleSidebarOpen = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("sidebar-collapsed", next ? "0" : "1");
      } catch {
        // no-op
      }
      return next;
    });
  }, []);

  const clearBadge = useCallback(async (onDone?: () => void) => {
    try {
      const res = await portalApiFetch("/portal/conversations/read-all", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.ok) {
        onDone?.();
      }
    } catch { /* */ }
  }, []);

  const bubbleTheme = widgetSettings
    ? resolveWidgetBubbleTheme(
        {
          primaryColor: widgetSettings.primaryColor,
          bubbleShape: widgetSettings.bubbleShape,
          bubbleIcon: widgetSettings.bubbleIcon,
          bubbleSize: widgetSettings.bubbleSize,
          bubblePosition: widgetSettings.bubblePosition,
          greetingText: widgetSettings.greetingText,
          greetingEnabled: widgetSettings.greetingEnabled,
        },
        {
          position: widgetSettings.position,
          launcher: widgetSettings.launcher,
          launcherLabel: "",
        }
      )
    : null;

  const renderBubbleIcon = () => {
    if (!bubbleTheme) return null;
    if (bubbleTheme.bubbleIcon === "help") {
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9.4a2.3 2.3 0 0 1 4.4.9c0 1.9-2.2 2.1-2.2 3.5" />
          <circle cx="12" cy="17.1" r="1" fill="#FFF" stroke="none" />
        </svg>
      );
    }
    if (bubbleTheme.bubbleIcon === "message") {
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v10H8l-4 4V5z" />
        </svg>
      );
    }
    if (bubbleTheme.bubbleIcon === "custom") {
      return <span className="text-[15px] font-bold text-white">★</span>;
    }
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5] isolate">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-[90] h-full overflow-hidden border-r border-black/10 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.04)] transform transition-all duration-300 ease-in-out flex flex-col w-[260px] ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarOpen ? "lg:w-[260px]" : "lg:w-[72px]"} lg:translate-x-0`}
        style={{ transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" }}
      >
        <div
          className={`shrink-0 ${sidebarOpen ? "px-5 py-5" : "px-[15px] py-[15px]"}`}
          style={{
            background: `linear-gradient(135deg, ${colors.brand.primary} 0%, ${colors.brand.secondary} 60%, ${colors.brand.tertiary} 100%)`,
          }}
        >
          {sidebarOpen ? (
            <div className="flex w-full items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <div
                  className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] border"
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    borderColor: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span className="font-[var(--font-heading)] text-[17px] font-extrabold text-white">H</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-[var(--font-heading)] text-[15px] font-bold text-white">{t("nav.customerPortal")}</p>
                  <p className="truncate font-[var(--font-body)] text-[11.5px] text-white/70">{user?.orgName || t("portal.organization")}</p>
                </div>
              </div>
              <button
                onClick={toggleSidebarOpen}
                className="hidden h-[30px] w-[30px] items-center justify-center rounded-lg bg-white/15 text-white transition-all duration-200 hover:scale-110 hover:bg-white/30 lg:inline-flex"
                title={t("nav.closeMenu")}
                aria-label={t("nav.closeMenu")}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-lg bg-white/15 p-1.5 text-white/80 transition-colors hover:bg-white/25 hover:text-white lg:hidden"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={toggleSidebarOpen}
                className="mx-auto hidden h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-white/15 transition-all duration-200 hover:scale-[1.08] hover:bg-white/30 lg:flex"
                title={t("nav.openMenu")}
                aria-label={t("nav.openMenu")}
              >
                <span className="flex flex-col gap-[5px]">
                  <span className="h-[2.5px] w-5 rounded bg-white" />
                  <span className="h-[2.5px] w-5 rounded bg-white" />
                  <span className="h-[2.5px] w-5 rounded bg-white" />
                </span>
              </button>
              <div className="flex w-full items-center justify-between lg:hidden">
                <p className="truncate font-[var(--font-heading)] text-[15px] font-bold text-white">{t("nav.customerPortal")}</p>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded-lg bg-white/15 p-1.5 text-white/80 transition-colors hover:bg-white/25 hover:text-white"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
            </>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto bg-white ${sidebarOpen ? "p-3" : "px-2 py-3"}`}>
          {navSections.map((section) => (
            <div key={section.sectionKey} className="mb-4 last:mb-0">
              {sidebarOpen ? (
                <div className="px-[14px] pt-[10px] pb-1">
                  <span className="font-[var(--font-heading)] text-[10px] font-bold uppercase tracking-[0.1em] text-[#D97706]">
                    {t(section.sectionKey)}
                  </span>
                </div>
              ) : (
                <div className="px-2 py-2">
                  <div className="h-px bg-black/5" />
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  if (item.roles && !item.roles.includes(userRole as "owner" | "admin")) {
                    return null;
                  }
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  const showUnread = item.badge === "unread" && totalUnread > 0;
                  const isInboxItem = item.href === "/portal/inbox";
                  const iconToneClass = isActive
                    ? "[--icon-stroke:#FFFFFF] [--icon-bg:rgba(255,255,255,0.3)]"
                    : "[--icon-stroke:#64748B] [--icon-bg:rgba(245,158,11,0.12)] group-hover:[--icon-stroke:#92400E]";
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex rounded-[10px] transition-all duration-200 ${
                        isActive
                          ? "bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white shadow-[0_3px_12px_rgba(245,158,11,0.25)]"
                          : "bg-transparent text-[#52525B] hover:bg-[rgba(245,158,11,0.06)] hover:text-[#92400E]"
                      } ${sidebarOpen ? "items-center gap-3 px-[14px] py-[9px]" : "items-center justify-center px-2 py-2.5"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                      onClick={() => { setMobileSidebarOpen(false); }}
                    >
                      <span className="relative flex-shrink-0">
                        <Icon className={`h-5 w-5 flex-shrink-0 ${iconToneClass}`} />
                        {showUnread && (
                          sidebarOpen ? (
                            // Inbox item uses the inline badge next to label; keep icon clean.
                            isInboxItem ? null : (
                              <span className={`absolute -top-1 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-[10px] px-[7px] text-[10.5px] font-[var(--font-heading)] font-bold ${isActive ? "bg-white/30 text-white" : "bg-[#EF4444] text-white"} bell-dot`}>
                                {totalUnread > 99 ? "99+" : totalUnread}
                              </span>
                            )
                          ) : (
                            // Inbox item uses the inline badge; keep icon clean.
                            isInboxItem ? null : (
                              <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border-2 ${isActive ? "border-white bg-white/85" : "border-white bg-[#EF4444]"} bell-dot`} />
                            )
                          )
                        )}
                      </span>
                      {sidebarOpen ? (
                        <span className={`truncate font-[var(--font-body)] text-[13.5px] ${isActive ? "font-bold text-white" : "font-medium text-[#52525B] group-hover:text-[#92400E]"}`}>{t(item.labelKey)}</span>
                      ) : (
                        <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1A1D23] px-3 py-1.5 font-[var(--font-body)] text-xs font-semibold text-white shadow-lg lg:group-hover:block">
                          {t(item.labelKey)}
                          <span className="absolute left-[-4px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-[#1A1D23]" />
                        </span>
                      )}

                      {/* Sidebar inbox badge (requested inline JSX) */}
                      {sidebarOpen && isInboxItem && totalUnread > 0 && (
                        <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
                          {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {sidebarOpen && showSidebarUpgradeCta && (
        <div className="shrink-0 border-t border-black/5 bg-white px-4 pb-4 pt-3">
          <div
            className="rounded-xl border px-3.5 py-3"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.ultraLight}, ${colors.brand.light})`,
              borderColor: "rgba(245, 158, 11, 0.1)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[18px] leading-none">🚀</span>
                  <p className="truncate font-[var(--font-heading)] text-[12px] font-bold text-[#92400E]">{t("billing.upgradeNow")}</p>
                </div>
                <p className="mt-1 truncate font-[var(--font-body)] text-[10.5px] text-[#B45309]/70">{t("billing.subtitle")}</p>
              </div>
              <Link
                href="/portal/pricing"
                className="inline-flex flex-shrink-0 items-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#D97706] px-2.5 py-1.5 font-[var(--font-heading)] text-[11px] font-bold text-white shadow-[0_3px_10px_rgba(245,158,11,0.28)]"
                onClick={() => setMobileSidebarOpen(false)}
              >
                {t("billing.upgrade")}
              </Link>
            </div>
          </div>
        </div>
        )}
      </aside>

      <div
        className={`portal-shell relative z-0 ${sidebarOpen ? "lg:pl-[260px]" : "lg:pl-[72px]"} transition-[padding] duration-300`}
        data-sidebar-collapsed={sidebarOpen ? "0" : "1"}
        style={{ transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" }}
      >
        {/* Top bar */}
        <header className="relative h-16 bg-white/95 backdrop-blur-md border-b border-[#F3E8D8] flex items-center px-5 sticky top-0 z-[100] shadow-sm pointer-events-auto">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="relative z-[2] lg:hidden hover:bg-amber-50 rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Menu size={20} strokeWidth={2} className="text-amber-500" />
          </button>

          {/* Campaign gradient — blends into header background */}
          <div className="hidden lg:contents">
            <CampaignTopBanner source="portal" variant="inline" />
          </div>

          <div className="relative z-[2] ml-auto flex items-center gap-2">
            {deployEnv === "staging" && (
              <span className="hidden sm:inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-800">
                STAGING
              </span>
            )}
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setBellOpen((o) => !o); }}
                className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-black/[0.03] transition-all duration-200 hover:scale-105 hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                title={t("inbox.bell.recentMessages")}
                aria-label={t("inbox.bell.recentMessages")}
                aria-expanded={bellOpen}
              >
                <Bell size={18} strokeWidth={2} className="text-amber-600 transition-colors duration-200 group-hover:text-[#64748B]" />
                {totalUnread > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-white bg-[#EF4444] bell-dot" />
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-[#F3E8D8] bg-white shadow-xl shadow-amber-200/30 overflow-hidden z-30">
                  {/* Header */}
                  <div className={`px-5 py-4 ${totalUnread > 0 ? "bg-gradient-to-r from-amber-50 to-amber-50/80 border-b border-amber-100/60" : "bg-[#FFFBF5]/80 border-b border-[#F3E8D8]"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalUnread > 0 ? "bg-amber-500/10" : "bg-amber-100/60"}`}>
                          <Bell size={15} className={totalUnread > 0 ? "text-amber-600" : "text-amber-500"} />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-amber-900">
                            {totalUnread > 0
                              ? t("inbox.bell.unreadCount").replace("{count}", String(totalUnread))
                              : t("inbox.bell.noUnread")}
                          </p>
                          <p className="text-[11px] text-amber-500 mt-0.5">{t("inbox.bell.recentMessages")}</p>
                        </div>
                      </div>
                      {totalUnread > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold text-red-700 bg-red-100 rounded-full">
                          {totalUnread}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => goToInbox(totalUnread > 0)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-amber-800 hover:bg-[#FFFBF5] transition-all duration-150"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Inbox size={14} className="text-amber-600" />
                      </div>
                      {t("nav.inbox")}
                    </button>
                    {totalUnread > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearBadge(() => setBellOpen(false)); }}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-amber-700 hover:bg-amber-50 transition-all duration-150"
                      >
                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <CheckCheck size={14} className="text-amber-600" />
                        </div>
                        {t("inbox.markAllRead")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <LanguageSwitcher />
            {user ? (
              <div className="ml-1 flex items-center gap-2">
                <div className="hidden sm:block text-right mr-1">
                  <p className="text-[13px] font-semibold text-amber-900 leading-tight">
                    {user.email}
                  </p>
                  <p className="text-[11px] text-amber-600">{user.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/portal/settings")}
                  className="group flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border-2 border-white/80 shadow-[0_2px_8px_rgba(245,158,11,0.25)] transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(245,158,11,0.35)]"
                  style={{ background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})` }}
                  title={t("nav.settings")}
                  aria-label={t("nav.settings")}
                >
                  {userAvatarUrl ? (
                    <img src={userAvatarUrl} alt={t("nav.settings")} className="h-full w-full rounded-[10px] object-cover" />
                  ) : (
                    <span className="font-[var(--font-heading)] text-[14px] font-bold text-white">
                      {avatarLetter}
                    </span>
                  )}
                </button>
              </div>
            ) : null}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-2.5 py-2 text-[13px] text-amber-700 hover:bg-amber-50 hover:text-amber-900 rounded-lg transition-all duration-150"
              title={t("common.logout")}
            >
              <LogOut size={15} strokeWidth={2} />
              <span className="hidden sm:inline font-medium">{t("common.logout")}</span>
            </button>
          </div>
        </header>

        <div className="lg:hidden">
          <CampaignTopBanner source="portal" />
        </div>

        <ErrorBoundary>
          {pathname === "/portal/inbox" ? (
            <>{children}</>
          ) : (
            <main className="relative z-0 p-5 sm:p-6">{children}</main>
          )}
        </ErrorBoundary>
      </div>

      {/* ── Floating Widget Bubble (customer's own customization) ── */}
      {widgetSettings && bubbleTheme && (
        <div
          className={`fixed bottom-6 z-[60] ${bubbleTheme.bubblePosition === "bottom-left" ? "left-6 lg:left-[276px]" : "right-6"}`}
          onMouseEnter={() => setBubbleHover(true)}
          onMouseLeave={() => setBubbleHover(false)}
        >
          {/* Tooltip on hover */}
          <div
            className={`absolute bottom-full mb-2.5 ${bubbleTheme.bubblePosition === "bottom-left" ? "left-0" : "right-0"} transition-all duration-200 pointer-events-none ${
              bubbleHover ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            }`}
          >
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[11px] font-semibold px-3 py-2 rounded-xl shadow-lg whitespace-nowrap">
              {widgetSettings.welcomeTitle}
              <div className={`absolute -bottom-1 ${bubbleTheme.bubblePosition === "bottom-left" ? "left-5" : "right-5"} w-2 h-2 bg-amber-500 rotate-45`} />
            </div>
          </div>

          {bubbleTheme.greetingEnabled && bubbleTheme.greetingText ? (
            <div
              className={`mb-2 max-w-[210px] rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] font-semibold text-amber-800 shadow-lg ${
                bubbleTheme.bubblePosition === "bottom-left" ? "text-left" : "text-right"
              }`}
            >
              {bubbleTheme.greetingText}
            </div>
          ) : null}

          {/* Bubble / Button launcher */}
          <button
            type="button"
            onClick={() => router.push("/portal/widget-appearance")}
            className="group relative shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl active:scale-95"
            style={{
              backgroundColor: bubbleTheme.primaryColor,
              boxShadow: `0 8px 25px ${bubbleTheme.primaryColor}40, 0 4px 10px ${bubbleTheme.primaryColor}30`,
              width: bubbleTheme.bubbleSize,
              height: bubbleTheme.bubbleSize,
              borderRadius: bubbleBorderRadius(bubbleTheme.bubbleShape, bubbleTheme.bubbleSize),
            }}
            title={t("dashboard.widgetPreview.customize")}
          >
            {renderBubbleIcon()}
            {bubbleTheme.bubbleShape === "circle" && widgetSettings.launcher === "bubble" && (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ backgroundColor: bubbleTheme.primaryColor }}
              />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
