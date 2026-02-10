"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import {
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  AlertTriangle,
  Info,
  AlertOctagon,
  Shield,
  Activity,
  CreditCard,
  Settings,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import ErrorBanner from "@/components/ErrorBanner";
import { useHydrated } from "@/hooks/useHydrated";
import type { TranslationKey } from "@/i18n/translations";

/* ────────── Types ────────── */

interface NotifItem {
  id: string;
  createdAt: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  type: string;
  category?: string; // alias from API
  sourceAction?: string;
  titleKey: string;
  bodyKey: string;
  meta: Record<string, unknown> | null;
  readAt: string | null;
}

interface Prefs {
  securityEnabled: boolean;
  billingEnabled: boolean;
  widgetEnabled: boolean;
}

/* ────────── Helpers ────────── */

function formatDate(iso: string, hydrated: boolean): string {
  if (!hydrated) return iso.replace("T", " ").slice(0, 19);
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const severityConfig: Record<
  string,
  { icon: typeof Info; pill: string; labelKey: TranslationKey }
> = {
  INFO: {
    icon: Info,
    pill: "bg-blue-100 text-blue-700",
    labelKey: "notifications.severity.info",
  },
  WARN: {
    icon: AlertTriangle,
    pill: "bg-amber-100 text-amber-700",
    labelKey: "notifications.severity.warn",
  },
  CRITICAL: {
    icon: AlertOctagon,
    pill: "bg-red-100 text-red-700",
    labelKey: "notifications.severity.critical",
  },
};

const typeIcons: Record<string, typeof Shield> = {
  SECURITY: Shield,
  WIDGET_HEALTH: Activity,
  BILLING: CreditCard,
  SYSTEM: Settings,
};

/* ────────── Main ────────── */

export default function NotificationsPage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const hydrated = useHydrated();

  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // Preferences
  const [prefs, setPrefs] = useState<Prefs>({
    securityEnabled: true,
    billingEnabled: true,
    widgetEnabled: true,
  });
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Fetch preferences
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const res = await portalApiFetch("/portal/notifications/preferences");
        if (res.ok) {
          const data = await res.json();
          setPrefs({
            securityEnabled: data.securityEnabled ?? true,
            billingEnabled: data.billingEnabled ?? true,
            widgetEnabled: data.widgetEnabled ?? true,
          });
        }
      } catch {
        // silent
      }
    })();
  }, [authLoading, user]);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (cursor?: string, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "25");
        if (cursor) params.set("cursor", cursor);
        if (tab === "unread") params.set("unreadOnly", "1");
        if (categoryFilter) params.set("category", categoryFilter);

        const res = await portalApiFetch(
          `/portal/notifications?${params.toString()}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items || []);
        }
        setNextCursor(data.nextCursor);
        setUnreadCount(data.unreadCount ?? 0);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t("common.error.unknown"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, categoryFilter]
  );

  useEffect(() => {
    if (!authLoading && user) fetchNotifications();
  }, [authLoading, user, fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      const res = await portalApiFetch(`/portal/notifications/${id}/read`, {
        method: "POST",
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await portalApiFetch("/portal/notifications/mark-all-read", {
        method: "POST",
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((n) => ({
            ...n,
            readAt: n.readAt || new Date().toISOString(),
          }))
        );
        setUnreadCount(0);
      }
    } catch {
      // silent
    }
  };

  const handlePrefToggle = async (
    key: keyof Prefs,
    value: boolean
  ) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    setPrefsSaved(false);
    try {
      const res = await portalApiFetch("/portal/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ [key]: value }),
      });
      if (res.ok) {
        setPrefsSaved(true);
        setTimeout(() => setPrefsSaved(false), 2000);
        // Refresh list to reflect new filtering
        fetchNotifications();
      }
    } catch {
      // Revert on failure
      setPrefs(prefs);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#1A1A2E] transition-colors mb-3 group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              {t("portalOnboarding.backToDashboard")}
            </Link>
            <div className="flex items-center gap-3">
              <Bell size={24} className="text-slate-600" />
              <h1 className="text-2xl font-bold text-slate-900">
                {t("notifications.title")}
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <CheckCircle size={16} />
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Preferences */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {t("notifications.preferencesTitle")}
            </h3>
            {prefsSaved && (
              <span className="text-xs text-emerald-600 font-medium">
                {t("notifications.saved")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            {([
              { key: "securityEnabled" as const, label: "notifications.prefSecurity" as TranslationKey },
              { key: "billingEnabled" as const, label: "notifications.prefBilling" as TranslationKey },
              { key: "widgetEnabled" as const, label: "notifications.prefWidget" as TranslationKey },
            ]).map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => handlePrefToggle(key, e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span className="text-sm text-slate-600">{t(label)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Tabs + Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setTab("all")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t("notifications.all")}
            </button>
            <button
              onClick={() => setTab("unread")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === "unread"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t("notifications.unread")}
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">
              {t("notifications.filter.category")}:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="">{t("notifications.all")}</option>
              <option value="security">{t("notifications.category.security")}</option>
              <option value="billing">{t("notifications.category.billing")}</option>
              <option value="widget">{t("notifications.category.widget")}</option>
              <option value="system">{t("notifications.category.system")}</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900" />
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Bell size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 text-sm">
                {t("notifications.empty")}
              </p>
            </div>
          ) : (
            items.map((item) => {
              const sev =
                severityConfig[item.severity] || severityConfig.INFO;
              const SevIcon = sev.icon;
              const TypeIcon = typeIcons[item.type] || Settings;
              const isUnread = !item.readAt;

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-4 transition-colors ${
                    isUnread
                      ? "border-blue-200 bg-blue-50/30"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <TypeIcon size={18} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sev.pill}`}
                        >
                          <SevIcon size={12} />
                          {t(sev.labelKey)}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                          {t(
                            (`notifications.category.${item.type.toLowerCase().replace("_", "")}` as TranslationKey) ||
                            "notifications.type.system"
                          )}
                        </span>
                        {isUnread && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {t(item.titleKey as TranslationKey)}
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {t(item.bodyKey as TranslationKey)}
                      </p>
                      <p
                        className="text-xs text-slate-400 mt-2"
                        suppressHydrationWarning
                      >
                        {formatDate(item.createdAt, hydrated)}
                      </p>
                    </div>
                    {isUnread && (
                      <button
                        onClick={() => handleMarkRead(item.id)}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        {t("notifications.markRead")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Load More */}
        {nextCursor && !loading && (
          <div className="text-center">
            <button
              onClick={() => fetchNotifications(nextCursor, true)}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600" />
              ) : (
                <ChevronDown size={16} />
              )}
              {t("notifications.loadMore")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
