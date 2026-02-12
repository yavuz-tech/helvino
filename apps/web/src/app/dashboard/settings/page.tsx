"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import { useOrg } from "@/contexts/OrgContext";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/i18n/I18nContext";
import MfaSetupSection from "@/components/MfaSetupSection";
import PasskeySection from "@/components/PasskeySection";
import { useStepUp } from "@/contexts/StepUpContext";
import { colors, fonts } from "@/lib/design-tokens";

interface OrgSettings {
  widgetEnabled: boolean;
  writeEnabled: boolean;
  aiEnabled: boolean;
  primaryColor: string | null;
  messageRetentionDays: number;
  hardDeleteOnRetention: boolean;
  lastRetentionRunAt: string | null;
}

interface BillingInfo {
  stripeConfigured: boolean;
  org: {
    id: string;
    key: string;
    name: string;
  };
  billing: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    billingStatus: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    billingEnforced: boolean;
    billingGraceDays: number;
    lastStripeEventAt: string | null;
  };
}

interface UsageInfo {
  org: { id: string; key: string; name: string };
  usage: {
    monthKey: string;
    conversationsCreated: number;
    messagesSent: number;
    nextResetDate: string;
  };
  limits: {
    planKey: string;
    planName: string;
    maxConversationsPerMonth: number;
    maxMessagesPerMonth: number;
    maxAgents: number;
    extraConversationQuota: number;
    extraMessageQuota: number;
  } | null;
}

interface OrgInfo {
  id: string;
  key: string;
  name: string;
}

interface PromoCodeItem {
  id: string;
  code: string;
  discountValue: number;
  currentUses: number;
  maxUses: number | null;
  validUntil: string | null;
  isActive: boolean;
  isGlobal: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  void colors;
  void fonts;
  const router = useRouter();
  const { t } = useI18n();
  const { withStepUp } = useStepUp();
  const { selectedOrg, isLoading: orgLoading } = useOrg();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<OrgSettings | null>(null);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [billingOriginal, setBillingOriginal] = useState<{
    billingEnforced: boolean;
    billingGraceDays: number;
  } | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageMessage, setUsageMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [resettingUsage, setResettingUsage] = useState(false);
  const [grantingQuota, setGrantingQuota] = useState(false);
  const [extraConvInput, setExtraConvInput] = useState(0);
  const [extraMsgInput, setExtraMsgInput] = useState(0);
  const [lockingBilling, setLockingBilling] = useState(false);
  const [unlockingBilling, setUnlockingBilling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [billingMessage, setBillingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [promoLoading, setPromoLoading] = useState(true);
  const [promoMessage, setPromoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [promoCreateCode, setPromoCreateCode] = useState("");
  const [promoCreateMaxUses, setPromoCreateMaxUses] = useState("");
  const [promoCreateValidUntil, setPromoCreateValidUntil] = useState("");
  const [promoCreating, setPromoCreating] = useState(false);
  const [promoUpdatingId, setPromoUpdatingId] = useState<string | null>(null);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaVerifiedAt, setMfaVerifiedAt] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  // Check authentication on mount
  useEffect(() => {
    const verifyAuth = async () => {
      const user = await checkAuth();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      setAuthLoading(false);
    };
    verifyAuth();
  }, [router]);

  // Fetch MFA status
  useEffect(() => {
    if (authLoading) return;
    const loadMfaStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/internal/security/mfa/status`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setMfaEnabled(data.mfaEnabled || false);
          setMfaVerifiedAt(data.mfaVerifiedAt || null);
        }
      } catch {
        // ignore
      }
    };
    loadMfaStatus();
  }, [authLoading, API_URL]);

  // Fetch current settings
  useEffect(() => {
    if (authLoading || orgLoading || !selectedOrg) return; // Wait for auth check and org selection

    const fetchSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/api/org/${selectedOrg.key}/settings`, {
          credentials: "include", // Use cookies instead of x-internal-key
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setOrgInfo(data.org);
        setSettings(data.settings);
        setOriginalSettings(data.settings);
      } catch (err) {
        console.error("Failed to fetch settings:", err);
        setError(t("settings.failedLoadSettings"));
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [API_URL, selectedOrg, authLoading, orgLoading, t]);

  // Fetch usage info
  useEffect(() => {
    if (authLoading || orgLoading || !selectedOrg) return;
    const fetchUsage = async () => {
      setUsageLoading(true);
      try {
        const response = await fetch(`${API_URL}/internal/org/${selectedOrg.key}/usage`, {
          credentials: "include",
        });
        if (response.ok) {
          const data: UsageInfo = await response.json();
          setUsageInfo(data);
          setExtraConvInput(data.limits?.extraConversationQuota || 0);
          setExtraMsgInput(data.limits?.extraMessageQuota || 0);
        }
      } catch (err) {
        console.error("Failed to fetch usage:", err);
      } finally {
        setUsageLoading(false);
      }
    };
    fetchUsage();
  }, [API_URL, selectedOrg, authLoading, orgLoading]);

  // Fetch billing info
  useEffect(() => {
    if (authLoading || orgLoading || !selectedOrg) return;

    const fetchBilling = async () => {
      setBillingLoading(true);
      try {
        const response = await fetch(`${API_URL}/internal/org/${selectedOrg.key}/billing`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: BillingInfo = await response.json();
        setBillingInfo(data);
        setBillingOriginal({
          billingEnforced: data.billing.billingEnforced,
          billingGraceDays: data.billing.billingGraceDays,
        });
      } catch (err) {
        console.error("Failed to fetch billing:", err);
      } finally {
        setBillingLoading(false);
      }
    };

    fetchBilling();
  }, [API_URL, selectedOrg, authLoading, orgLoading]);

  const fetchPromoCodes = async () => {
    if (!selectedOrg) return;
    setPromoLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/internal/promo-codes?orgKey=${encodeURIComponent(selectedOrg.key)}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as { items?: PromoCodeItem[] };
      setPromoCodes(data.items || []);
    } catch (err) {
      console.error("Failed to fetch promo codes:", err);
      setPromoMessage({ type: "error", text: t("settings.promoLoadFailed") });
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || orgLoading || !selectedOrg) return;
    fetchPromoCodes();
  }, [API_URL, selectedOrg, authLoading, orgLoading]);

  // Save settings
  const handleSave = async () => {
    if (!settings || !originalSettings || !selectedOrg) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      // Build update payload with only changed fields
      const updates: Partial<OrgSettings> = {};
      
      if (settings.widgetEnabled !== originalSettings.widgetEnabled) {
        updates.widgetEnabled = settings.widgetEnabled;
      }
      if (settings.writeEnabled !== originalSettings.writeEnabled) {
        updates.writeEnabled = settings.writeEnabled;
      }
      if (settings.aiEnabled !== originalSettings.aiEnabled) {
        updates.aiEnabled = settings.aiEnabled;
      }
      if (settings.messageRetentionDays !== originalSettings.messageRetentionDays) {
        updates.messageRetentionDays = settings.messageRetentionDays;
      }
      if (settings.hardDeleteOnRetention !== originalSettings.hardDeleteOnRetention) {
        updates.hardDeleteOnRetention = settings.hardDeleteOnRetention;
      }

      // Only send PATCH if there are changes
      if (Object.keys(updates).length === 0) {
        setSaveMessage({ type: "success", text: t("common.noChanges") });
        setTimeout(() => setSaveMessage(null), 3000);
        setSaving(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/org/${selectedOrg.key}/settings`, {
        method: "PATCH",
        credentials: "include", // Use cookies instead of x-internal-key
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSettings(data.settings);
      setOriginalSettings(data.settings);
      setSaveMessage({ type: "success", text: t("settings.saved") });

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setSaveMessage({ type: "error", text: t("settings.failedSave") });
    } finally {
      setSaving(false);
    }
  };

  const handleBillingSave = async () => {
    if (!billingInfo || !billingOriginal || !selectedOrg) return;

    const updates: { billingEnforced?: boolean; billingGraceDays?: number } = {};
    if (billingInfo.billing.billingEnforced !== billingOriginal.billingEnforced) {
      updates.billingEnforced = billingInfo.billing.billingEnforced;
    }
    if (billingInfo.billing.billingGraceDays !== billingOriginal.billingGraceDays) {
      updates.billingGraceDays = billingInfo.billing.billingGraceDays;
    }

    if (Object.keys(updates).length === 0) {
      setBillingMessage({ type: "success", text: t("settings.noBillingChanges") });
      setTimeout(() => setBillingMessage(null), 3000);
      return;
    }

    setBillingSaving(true);
    setBillingMessage(null);

    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/org/${selectedOrg.key}/billing`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
      "admin"
    );

    if (result.cancelled) { setBillingSaving(false); return; }
    if (!result.ok) {
      setBillingMessage({ type: "error", text: t("settings.failedSave") });
      setBillingSaving(false);
      return;
    }

    const data = result.data as Record<string, Record<string, unknown>> | undefined;
    if (data?.billing) {
      setBillingInfo({
        ...billingInfo,
        billing: {
          ...billingInfo.billing,
          billingEnforced: data.billing.billingEnforced as boolean,
          billingGraceDays: data.billing.billingGraceDays as number,
        },
      });
      setBillingOriginal({
        billingEnforced: data.billing.billingEnforced as boolean,
        billingGraceDays: data.billing.billingGraceDays as number,
      });
    }
    setBillingMessage({ type: "success", text: t("settings.saved") });
    setTimeout(() => setBillingMessage(null), 3000);
    setBillingSaving(false);
  };

  const handleStartSubscription = async () => {
    if (!selectedOrg) return;
    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/org/${selectedOrg.key}/billing/checkout-session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.origin + "/dashboard/settings" }),
      }),
      "admin"
    );
    if (result.cancelled) return;
    if (!result.ok) {
      setBillingMessage({ type: "error", text: t("settings.failedStartCheckout") });
      return;
    }
    const data = result.data as Record<string, string> | undefined;
    if (data?.url) window.location.href = data.url;
  };

  const handleManageBilling = async () => {
    if (!selectedOrg) return;
    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/org/${selectedOrg.key}/billing/portal-session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.origin + "/dashboard/settings" }),
      }),
      "admin"
    );
    if (result.cancelled) return;
    if (!result.ok) {
      setBillingMessage({ type: "error", text: t("settings.failedOpenPortal") });
      return;
    }
    const data = result.data as Record<string, string> | undefined;
    if (data?.url) window.location.href = data.url;
  };

  const handleResetUsage = async () => {
    if (!selectedOrg || !confirm(t("settings.resetUsageConfirm"))) return;
    setResettingUsage(true);
    setUsageMessage(null);
    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/org/${selectedOrg.key}/usage/reset`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }),
      "admin"
    );
    if (result.cancelled) { setResettingUsage(false); return; }
    if (!result.ok) {
      setUsageMessage({ type: "error", text: t("settings.failedResetUsage") });
      setResettingUsage(false);
      return;
    }
    setUsageMessage({ type: "success", text: t("settings.usageResetSuccess") });
    const res = await fetch(`${API_URL}/internal/org/${selectedOrg.key}/usage`, { credentials: "include" });
    if (res.ok) setUsageInfo(await res.json());
    setTimeout(() => setUsageMessage(null), 3000);
    setResettingUsage(false);
  };

  const handleGrantQuota = async () => {
    if (!selectedOrg) return;
    setGrantingQuota(true);
    setUsageMessage(null);
    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/org/${selectedOrg.key}/usage/grant-quota`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraConversations: extraConvInput,
          extraMessages: extraMsgInput,
        }),
      }),
      "admin"
    );
    if (result.cancelled) { setGrantingQuota(false); return; }
    if (!result.ok) {
      setUsageMessage({ type: "error", text: t("settings.failedGrantQuota") });
      setGrantingQuota(false);
      return;
    }
    setUsageMessage({ type: "success", text: t("settings.quotaUpdatedSuccess") });
    const res = await fetch(`${API_URL}/internal/org/${selectedOrg.key}/usage`, { credentials: "include" });
    if (res.ok) setUsageInfo(await res.json());
    setTimeout(() => setUsageMessage(null), 3000);
    setGrantingQuota(false);
  };

  const handleBillingLock = async () => {
    if (!selectedOrg || !confirm(t("settings.lockConfirm"))) return;
    setLockingBilling(true);
    setBillingMessage(null);
    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/org/${selectedOrg.key}/billing/lock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }),
      "admin"
    );
    if (result.cancelled) { setLockingBilling(false); return; }
    if (result.ok) {
      setBillingMessage({ type: "success", text: t("settings.billingLockedSuccess") });
      setTimeout(() => setBillingMessage(null), 3000);
    } else {
      setBillingMessage({ type: "error", text: t("settings.failedLockBilling") });
    }
    setLockingBilling(false);
  };

  const handleBillingUnlock = async () => {
    if (!selectedOrg || !confirm(t("settings.unlockConfirm"))) return;
    setUnlockingBilling(true);
    setBillingMessage(null);
    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/org/${selectedOrg.key}/billing/unlock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }),
      "admin"
    );
    if (result.cancelled) { setUnlockingBilling(false); return; }
    if (result.ok) {
      setBillingMessage({ type: "success", text: t("settings.billingUnlockedSuccess") });
      setTimeout(() => setBillingMessage(null), 3000);
    } else {
      setBillingMessage({ type: "error", text: t("settings.failedUnlockBilling") });
    }
    setUnlockingBilling(false);
  };

  const handleBillingReconcile = async () => {
    if (!selectedOrg) return;
    setReconciling(true);
    setBillingMessage(null);
    const result = await withStepUp(() =>
      fetch(`${API_URL}/internal/billing/reconcile`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgKey: selectedOrg.key }),
      }),
      "admin"
    );
    if (result.cancelled) { setReconciling(false); return; }
    if (!result.ok) {
      const data = result.data as Record<string, string> | undefined;
      setBillingMessage({ type: "error", text: data?.error || t("settings.reconcileFailed") });
      setReconciling(false);
      return;
    }
    setBillingMessage({ type: "success", text: t("settings.reconcileSuccess") });
    setReconciling(false);
  };

  const handleCreatePromoCode = async () => {
    if (!selectedOrg) return;
    const code = promoCreateCode.trim().toUpperCase();
    if (!code) {
      setPromoMessage({ type: "error", text: t("settings.promoCodeRequired") });
      return;
    }

    setPromoCreating(true);
    setPromoMessage(null);

    const maxUsesValue =
      promoCreateMaxUses.trim() === ""
        ? null
        : Math.max(1, parseInt(promoCreateMaxUses, 10) || 1);

    const result = await withStepUp(
      () =>
        fetch(`${API_URL}/internal/promo-codes`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgKey: selectedOrg.key,
            code,
            maxUses: maxUsesValue,
            validUntil: promoCreateValidUntil
              ? new Date(promoCreateValidUntil).toISOString()
              : null,
          }),
        }),
      "admin"
    );

    if (result.cancelled) {
      setPromoCreating(false);
      return;
    }
    if (!result.ok) {
      const data = result.data as { error?: string } | undefined;
      setPromoMessage({
        type: "error",
        text: data?.error || t("settings.promoCreateFailed"),
      });
      setPromoCreating(false);
      return;
    }

    setPromoCreateCode("");
    setPromoCreateMaxUses("");
    setPromoCreateValidUntil("");
    setPromoMessage({ type: "success", text: t("settings.promoCreateSuccess") });
    await fetchPromoCodes();
    setPromoCreating(false);
  };

  const handleTogglePromoCode = async (promo: PromoCodeItem) => {
    if (!selectedOrg) return;
    setPromoUpdatingId(promo.id);
    setPromoMessage(null);

    const result = await withStepUp(
      () =>
        fetch(`${API_URL}/internal/promo-codes/${promo.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgKey: selectedOrg.key,
            isActive: !promo.isActive,
          }),
        }),
      "admin"
    );

    if (result.cancelled) {
      setPromoUpdatingId(null);
      return;
    }
    if (!result.ok) {
      const data = result.data as { error?: string } | undefined;
      setPromoMessage({
        type: "error",
        text: data?.error || t("settings.promoUpdateFailed"),
      });
      setPromoUpdatingId(null);
      return;
    }

    setPromoMessage({
      type: "success",
      text: t("settings.promoUpdateSuccess"),
    });
    await fetchPromoCodes();
    setPromoUpdatingId(null);
  };

  // Check if there are unsaved changes
  const hasChanges = settings && originalSettings && (
    settings.widgetEnabled !== originalSettings.widgetEnabled ||
    settings.writeEnabled !== originalSettings.writeEnabled ||
    settings.aiEnabled !== originalSettings.aiEnabled ||
    settings.messageRetentionDays !== originalSettings.messageRetentionDays ||
    settings.hardDeleteOnRetention !== originalSettings.hardDeleteOnRetention
  );

  const hasBillingChanges =
    billingInfo &&
    billingOriginal &&
    (billingInfo.billing.billingEnforced !== billingOriginal.billingEnforced ||
      billingInfo.billing.billingGraceDays !== billingOriginal.billingGraceDays);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
        <div className="text-[#475569]">{t("common.checkingAuth")}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <DashboardLayout user={user} onLogout={handleLogout}>
        <div className="text-center py-12 text-[#64748B] text-sm">
          {t("settings.loadingSettings")}
        </div>
      </DashboardLayout>
    );
  }

  if (error || !settings || !orgInfo) {
    return (
      <DashboardLayout user={user} onLogout={handleLogout}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error || t("settings.failedLoadSettings")}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1D23]">{t("settings.orgSettings")}</h1>
        <p className="text-sm text-[#64748B] mt-1">
          {orgInfo.name} ({orgInfo.key})
        </p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className="max-w-4xl mx-auto px-6 pt-6">
          <div
            className={`rounded-lg p-4 ${
              saveMessage.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {saveMessage.text}
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-4 border-b border-[#F3E8D8] pb-4">
          <div className="px-4 py-2 border-b-2 border-amber-600 text-[#1A1D23] font-medium font-heading">
            {t("nav.generalSettings")}
          </div>
          <a
            href="/dashboard/settings/security"
            className="px-4 py-2 text-[#475569] hover:text-amber-800 transition-colors"
          >
            🔒 {t("nav.security")}
          </a>
        </div>

        {/* Kill Switches Section */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <h2 className="text-lg font-semibold text-[#1A1D23] font-heading mb-4">
            {t("settings.killSwitches")}
          </h2>
          <div className="space-y-4">
            {/* Widget Enabled */}
            <div className="flex items-center justify-between py-3 border-b border-amber-100">
              <div className="flex-1">
                <label className="text-sm font-medium text-[#1A1D23]">
                  {t("settings.widgetEnabled")}
                </label>
                <p className="text-xs text-[#64748B] mt-1">
                  {t("settings.widgetEnabledDesc")}
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, widgetEnabled: !settings.widgetEnabled })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.widgetEnabled ? "bg-green-600" : "bg-amber-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.widgetEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Write Enabled */}
            <div className="flex items-center justify-between py-3 border-b border-amber-100">
              <div className="flex-1">
                <label className="text-sm font-medium text-[#1A1D23]">
                  {t("settings.writeEnabled")}
                </label>
                <p className="text-xs text-[#64748B] mt-1">
                  {t("settings.writeEnabledDesc")}
                </p>
                {!settings.writeEnabled && (
                  <p className="text-xs text-orange-600 font-medium mt-2">
                    ⚠️ {t("settings.writeDisabledWarning")}
                  </p>
                )}
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, writeEnabled: !settings.writeEnabled })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.writeEnabled ? "bg-green-600" : "bg-amber-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.writeEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* AI Enabled */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-[#1A1D23]">
                  {t("settings.aiEnabled")}
                </label>
                <p className="text-xs text-[#64748B] mt-1">
                  {t("settings.aiEnabledDesc")}
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, aiEnabled: !settings.aiEnabled })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.aiEnabled ? "bg-green-600" : "bg-amber-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.aiEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Data Retention Section */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <h2 className="text-lg font-semibold text-[#1A1D23] font-heading mb-4">
            {t("settings.dataRetention")}
          </h2>
          <div className="space-y-4">
            {/* Retention Days */}
            <div className="py-3 border-b border-amber-100">
              <label className="block text-sm font-medium text-[#1A1D23] mb-2">
                {t("settings.retentionDays")}
              </label>
              <p className="text-xs text-[#64748B] mb-3">
                {t("settings.retentionDaysDesc")}
              </p>
              <input
                type="number"
                min="1"
                max="3650"
                value={settings.messageRetentionDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    messageRetentionDays: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full max-w-xs px-4 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <p className="text-xs text-[#64748B] mt-2">
                {t("settings.currentRetention")} {settings.messageRetentionDays} {t("settings.retentionDays2")} (~
                {Math.floor(settings.messageRetentionDays / 365)} {t("settings.retentionYears")})
              </p>
            </div>

            {/* Hard Delete */}
            <div className="py-3 border-b border-amber-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-[#1A1D23]">
                    {t("settings.hardDelete")}
                  </label>
                  <p className="text-xs text-[#64748B] mt-1">
                    {t("settings.hardDeleteDesc")}<br />
                    {t("settings.softDeleteDesc")}
                  </p>
                  {settings.hardDeleteOnRetention && (
                    <p className="text-xs text-red-600 font-medium mt-2">
                      ⚠️ {t("settings.hardDeleteWarning")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      hardDeleteOnRetention: !settings.hardDeleteOnRetention,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.hardDeleteOnRetention ? "bg-red-600" : "bg-amber-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.hardDeleteOnRetention ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Last Retention Run (Read-only) */}
            <div className="py-3">
              <label className="block text-sm font-medium text-[#1A1D23] mb-2">
                {t("settings.lastRetentionRun")}
              </label>
              <p className="text-sm text-[#475569]" suppressHydrationWarning>
                {settings.lastRetentionRunAt
                  ? new Date(settings.lastRetentionRunAt).toLocaleString()
                  : t("common.never")}
              </p>
              {settings.lastRetentionRunAt && (
                <p className="text-xs text-[#64748B] mt-1">
                  {t("settings.retentionJobDesc")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Usage & Overrides Section */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <h2 className="text-lg font-semibold text-[#1A1D23] font-heading mb-4">
            {t("settings.usageOverrides")}
          </h2>

          {usageMessage && (
            <div
              className={`rounded-lg p-3 mb-4 ${
                usageMessage.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {usageMessage.text}
            </div>
          )}

          {usageLoading || !usageInfo ? (
            <div className="text-[#475569] text-sm">{t("settings.loadingUsage")}</div>
          ) : (
            <div className="space-y-5">
              {/* Current Month Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#64748B] uppercase tracking-wider font-medium">
                    {t("settings.currentMonth")} {usageInfo.usage.monthKey}
                  </span>
                  <span className="text-xs text-[#64748B]" suppressHydrationWarning>
                    {t("settings.nextResetLabel")} {new Date(usageInfo.usage.nextResetDate).toLocaleDateString()}
                  </span>
                </div>
                {usageInfo.limits && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100">
                      <div className="text-xs text-[#64748B]">{t("settings.conversations")}</div>
                      <div className="text-lg font-semibold text-[#1A1D23]">
                        {usageInfo.usage.conversationsCreated} / {usageInfo.limits.maxConversationsPerMonth}
                      </div>
                      <div className="w-full bg-amber-200 rounded-full h-1.5 mt-1.5">
                        <div
                          className={`h-1.5 rounded-full ${usageInfo.usage.conversationsCreated >= usageInfo.limits.maxConversationsPerMonth ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min((usageInfo.usage.conversationsCreated / usageInfo.limits.maxConversationsPerMonth) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100">
                      <div className="text-xs text-[#64748B]">{t("settings.messages")}</div>
                      <div className="text-lg font-semibold text-[#1A1D23]">
                        {usageInfo.usage.messagesSent} / {usageInfo.limits.maxMessagesPerMonth}
                      </div>
                      <div className="w-full bg-amber-200 rounded-full h-1.5 mt-1.5">
                        <div
                          className={`h-1.5 rounded-full ${usageInfo.usage.messagesSent >= usageInfo.limits.maxMessagesPerMonth ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min((usageInfo.usage.messagesSent / usageInfo.limits.maxMessagesPerMonth) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reset Usage */}
              <div className="border-t border-amber-100 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1A1D23]">{t("settings.resetUsage")}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {t("settings.resetUsageDesc")}
                    </p>
                  </div>
                  <button
                    onClick={handleResetUsage}
                    disabled={resettingUsage}
                    className="px-4 py-2 bg-orange-50 text-orange-900 text-sm rounded-lg hover:bg-orange-100 disabled:opacity-50 border border-orange-200"
                  >
                    {resettingUsage ? t("settings.resetting") : t("settings.resetUsage")}
                  </button>
                </div>
              </div>

              {/* Grant Extra Quota */}
              <div className="border-t border-amber-100 pt-4">
                <p className="text-sm font-medium text-[#1A1D23] mb-1">{t("settings.grantQuota")}</p>
                <p className="text-xs text-[#64748B] mb-3">
                  {t("settings.grantQuotaDesc")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-[#475569] mb-1">{t("settings.extraConversations")}</label>
                    <input
                      type="number"
                      min="0"
                      value={extraConvInput}
                      onChange={(e) => setExtraConvInput(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#475569] mb-1">{t("settings.extraMessages")}</label>
                    <input
                      type="number"
                      min="0"
                      value={extraMsgInput}
                      onChange={(e) => setExtraMsgInput(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
                <button
                  onClick={handleGrantQuota}
                  disabled={grantingQuota}
                  className="mt-3 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {grantingQuota ? t("common.saving") : t("settings.updateQuota")}
                </button>
              </div>

              {/* Manual Billing Lock/Unlock */}
              <div className="border-t border-amber-100 pt-4">
                <p className="text-sm font-medium text-[#1A1D23] mb-1">{t("settings.manualBillingLock")}</p>
                <p className="text-xs text-[#64748B] mb-3">
                  {t("settings.manualLockDesc")}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleBillingLock}
                    disabled={lockingBilling}
                    className="px-4 py-2 bg-red-50 text-red-900 text-sm rounded-lg hover:bg-red-100 disabled:opacity-50 border border-red-200"
                  >
                    {lockingBilling ? t("settings.locking") : t("settings.lockBilling")}
                  </button>
                  <button
                    onClick={handleBillingUnlock}
                    disabled={unlockingBilling}
                    className="px-4 py-2 bg-green-50 text-green-900 text-sm rounded-lg hover:bg-green-100 disabled:opacity-50 border border-green-200"
                  >
                    {unlockingBilling ? t("settings.unlocking") : t("settings.unlockBilling")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MFA Section */}
        <MfaSetupSection
          mfaEnabled={mfaEnabled}
          mfaVerifiedAt={mfaVerifiedAt}
          onSetup={async () => {
            try {
              const res = await fetch(`${API_URL}/internal/security/mfa/setup`, {
                method: "POST",
                credentials: "include",
              });
              if (!res.ok) return null;
              return await res.json();
            } catch {
              return null;
            }
          }}
          onVerify={async (code) => {
            try {
              const res = await fetch(`${API_URL}/internal/security/mfa/verify`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
              });
              return res.ok;
            } catch {
              return false;
            }
          }}
          onDisable={async (code) => {
            try {
              const res = await fetch(`${API_URL}/internal/security/mfa/disable`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
              });
              return res.ok;
            } catch {
              return false;
            }
          }}
          onRefresh={async () => {
            try {
              const res = await fetch(`${API_URL}/internal/security/mfa/status`, {
                credentials: "include",
              });
              if (res.ok) {
                const data = await res.json();
                setMfaEnabled(data.mfaEnabled || false);
                setMfaVerifiedAt(data.mfaVerifiedAt || null);
              }
            } catch {
              // ignore
            }
          }}
        />

        {/* Passkeys Section */}
        <PasskeySection area="admin" />

        {/* Billing Section */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <h2 className="text-lg font-semibold text-[#1A1D23] font-heading mb-4">
            {t("settings.billing")}
          </h2>

          {billingMessage && (
            <div
              className={`rounded-lg p-3 mb-4 ${
                billingMessage.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {billingMessage.text}
            </div>
          )}

          {billingLoading || !billingInfo ? (
            <div className="text-[#475569]">{t("settings.loadingBilling")}</div>
          ) : (
            <div className="space-y-4">
              {!billingInfo.stripeConfigured && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-900 text-sm">
                  {t("settings.stripeNotConfigured")}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-amber-50/50 rounded-lg border border-amber-200/70 p-4">
                  <div className="text-xs text-[#64748B]">{t("settings.billingStatus")}</div>
                  <div className="text-lg font-semibold text-[#1A1D23] capitalize">
                    {billingInfo.billing.billingStatus}
                  </div>
                  <div className="text-xs text-[#64748B] mt-2">
                    {t("settings.cancelAtPeriodEnd")}{" "}
                    {billingInfo.billing.cancelAtPeriodEnd ? t("common.yes") : t("common.no")}
                  </div>
                </div>
                <div className="bg-amber-50/50 rounded-lg border border-amber-200/70 p-4">
                  <div className="text-xs text-[#64748B]">{t("settings.currentPeriodEnd")}</div>
                  <div className="text-sm font-semibold text-[#1A1D23]" suppressHydrationWarning>
                    {billingInfo.billing.currentPeriodEnd
                      ? new Date(billingInfo.billing.currentPeriodEnd).toLocaleString()
                      : "-"}
                  </div>
                  <div className="text-xs text-[#64748B] mt-2">
                    {t("settings.priceId")} {billingInfo.billing.stripePriceId || "-"}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleStartSubscription}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  disabled={!billingInfo.stripeConfigured}
                >
                  {t("settings.startSubscription")}
                </button>
                <button
                  onClick={handleManageBilling}
                  className="px-4 py-2 bg-amber-50 text-amber-900 rounded-lg hover:bg-amber-100 disabled:opacity-50 border border-amber-200"
                  disabled={!billingInfo.stripeConfigured}
                >
                  {t("settings.manageBilling")}
                </button>
                <button
                  onClick={handleBillingReconcile}
                  className="px-4 py-2 bg-amber-50 text-amber-900 rounded-lg hover:bg-amber-100 disabled:opacity-50 border border-amber-200"
                  disabled={reconciling}
                >
                  {reconciling ? t("settings.reconciling") : t("settings.reconcileBilling")}
                </button>
              </div>

              <div className="border-t border-amber-100 pt-4">
                <div className="flex items-center justify-between py-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-[#1A1D23]">
                      {t("settings.enforceBilling")}
                    </label>
                    <p className="text-xs text-[#64748B] mt-1">
                      {t("settings.enforceBillingDesc")}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setBillingInfo({
                        ...billingInfo,
                        billing: {
                          ...billingInfo.billing,
                          billingEnforced: !billingInfo.billing.billingEnforced,
                        },
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      billingInfo.billing.billingEnforced ? "bg-green-600" : "bg-amber-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        billingInfo.billing.billingEnforced ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="py-3">
                  <label className="block text-sm font-medium text-[#1A1D23] mb-2">
                    {t("settings.graceDays")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={billingInfo.billing.billingGraceDays}
                    onChange={(e) =>
                      setBillingInfo({
                        ...billingInfo,
                        billing: {
                          ...billingInfo.billing,
                          billingGraceDays: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="w-full max-w-xs px-4 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-[#475569]">
                    {hasBillingChanges ? (
                      <span className="text-orange-600 font-medium">
                        ⚠️ {t("settings.unsavedBilling")}
                      </span>
                    ) : (
                      <span>{t("settings.noBillingChanges")}</span>
                    )}
                  </div>
                  <button
                    onClick={handleBillingSave}
                    disabled={!hasBillingChanges || billingSaving}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      hasBillingChanges && !billingSaving
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-90"
                        : "bg-amber-200 text-[#64748B] cursor-not-allowed"
                    }`}
                  >
                    {billingSaving ? t("common.saving") : t("settings.saveBilling")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Promo Codes Section */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <h2 className="text-lg font-semibold text-[#1A1D23] font-heading mb-4">
            {t("settings.promoCodes")}
          </h2>
          <p className="text-xs text-[#64748B] mb-4">
            {t("settings.promoCodesDesc")}
          </p>

          {promoMessage && (
            <div
              className={`rounded-lg p-3 mb-4 ${
                promoMessage.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {promoMessage.text}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs text-[#475569] mb-1">
                {t("settings.promoCode")}
              </label>
              <input
                type="text"
                value={promoCreateCode}
                onChange={(e) => setPromoCreateCode(e.target.value.toUpperCase())}
                placeholder={t("settings.promoCodePlaceholder")}
                className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-[#475569] mb-1">
                {t("settings.promoMaxUses")}
              </label>
              <input
                type="number"
                min="1"
                value={promoCreateMaxUses}
                onChange={(e) => setPromoCreateMaxUses(e.target.value)}
                placeholder={t("settings.promoUnlimitedPlaceholder")}
                className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-[#475569] mb-1">
                {t("settings.promoValidUntil")}
              </label>
              <input
                type="datetime-local"
                value={promoCreateValidUntil}
                onChange={(e) => setPromoCreateValidUntil(e.target.value)}
                className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <button
            onClick={handleCreatePromoCode}
            disabled={promoCreating}
            className="mt-3 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {promoCreating ? t("settings.promoCreating") : t("settings.promoCreate")}
          </button>

          <div className="border-t border-amber-100 mt-5 pt-4">
            {promoLoading ? (
              <div className="text-sm text-[#475569]">{t("settings.promoLoading")}</div>
            ) : promoCodes.length === 0 ? (
              <div className="text-sm text-[#475569]">{t("settings.promoEmpty")}</div>
            ) : (
              <div className="space-y-2">
                {promoCodes.map((promo) => (
                  <div
                    key={promo.id}
                    className="rounded-lg border border-amber-200/70 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#1A1D23]">
                        {promo.code} ({promo.discountValue}%)
                      </div>
                      <div className="text-xs text-[#64748B] mt-1" suppressHydrationWarning>
                        {t("settings.promoUsage")}: {promo.currentUses}/
                        {promo.maxUses ?? t("settings.promoUnlimited")}
                        {" • "}
                        {t("settings.promoStatus")}:{" "}
                        {promo.isActive ? t("settings.promoActive") : t("settings.promoInactive")}
                        {" • "}
                        {t("settings.promoValidUntilLabel")}:{" "}
                        {promo.validUntil
                          ? new Date(promo.validUntil).toLocaleString()
                          : t("settings.promoNoExpiry")}
                      </div>
                    </div>
                    <button
                      onClick={() => handleTogglePromoCode(promo)}
                      disabled={promoUpdatingId === promo.id}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${
                        promo.isActive
                          ? "bg-red-50 border-red-200 text-red-800 hover:bg-red-100"
                          : "bg-green-50 border-green-200 text-green-800 hover:bg-green-100"
                      } disabled:opacity-50`}
                    >
                      {promoUpdatingId === promo.id
                        ? t("settings.promoUpdating")
                        : promo.isActive
                          ? t("settings.promoDeactivate")
                          : t("settings.promoActivate")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-[#F3E8D8] p-6">
          <div className="text-sm text-[#475569]">
            {hasChanges ? (
              <span className="text-orange-600 font-medium">
                ⚠️ {t("common.unsavedChanges")}
              </span>
            ) : (
              <span>{t("common.noChanges")}</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              hasChanges && !saving
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-90"
                : "bg-amber-200 text-[#64748B] cursor-not-allowed"
            }`}
          >
            {saving ? t("common.saving") : t("common.saveChanges")}
          </button>
        </div>

        {/* Info Section */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-900 font-heading mb-2">
            ℹ️ {t("settings.importantNotes")}
          </h3>
          <ul className="text-xs text-amber-800 space-y-1">
            <li>
              • {t("settings.note1")}
            </li>
            <li>
              • {t("settings.note2")}
            </li>
            <li>
              • {t("settings.note3")}
            </li>
            <li>
              • {t("settings.note4")}
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
