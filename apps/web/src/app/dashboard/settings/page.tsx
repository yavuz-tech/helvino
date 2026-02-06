"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import { useOrg } from "@/contexts/OrgContext";
import DashboardLayout from "@/components/DashboardLayout";

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

interface OrgInfo {
  id: string;
  key: string;
  name: string;
}

export default function SettingsPage() {
  const router = useRouter();
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
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [billingMessage, setBillingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
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
        setSaveMessage({ type: "success", text: "No changes to save" });
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
      setSaveMessage({ type: "success", text: "Settings saved successfully" });

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setSaveMessage({ type: "error", text: "Failed to save settings" });
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
      setBillingMessage({ type: "success", text: "No billing changes to save" });
      setTimeout(() => setBillingMessage(null), 3000);
      return;
    }

    setBillingSaving(true);
    setBillingMessage(null);

    try {
      const response = await fetch(`${API_URL}/internal/org/${selectedOrg.key}/billing`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setBillingInfo({
        ...billingInfo,
        billing: {
          ...billingInfo.billing,
          billingEnforced: data.billing.billingEnforced,
          billingGraceDays: data.billing.billingGraceDays,
        },
      });
      setBillingOriginal({
        billingEnforced: data.billing.billingEnforced,
        billingGraceDays: data.billing.billingGraceDays,
      });
      setBillingMessage({ type: "success", text: "Billing settings saved" });
      setTimeout(() => setBillingMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save billing settings:", err);
      setBillingMessage({ type: "error", text: "Failed to save billing settings" });
    } finally {
      setBillingSaving(false);
    }
  };

  const handleStartSubscription = async () => {
    if (!selectedOrg) return;
    const response = await fetch(
      `${API_URL}/internal/org/${selectedOrg.key}/billing/checkout-session`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnUrl: window.location.origin + "/dashboard/settings",
        }),
      }
    );

    if (!response.ok) {
      setBillingMessage({ type: "error", text: "Failed to start checkout" });
      return;
    }

    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const handleManageBilling = async () => {
    if (!selectedOrg) return;
    const response = await fetch(
      `${API_URL}/internal/org/${selectedOrg.key}/billing/portal-session`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnUrl: window.location.origin + "/dashboard/settings",
        }),
      }
    );

    if (!response.ok) {
      setBillingMessage({ type: "error", text: "Failed to open billing portal" });
      return;
    }

    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const handleBillingReconcile = async () => {
    if (!selectedOrg) return;
    setReconciling(true);
    setBillingMessage(null);
    try {
      const response = await fetch(`${API_URL}/internal/billing/reconcile`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgKey: selectedOrg.key }),
      });

      if (!response.ok) {
        const data = await response.json();
        setBillingMessage({
          type: "error",
          text: data.error || "Billing reconcile failed",
        });
        return;
      }

      setBillingMessage({
        type: "success",
        text: "Billing reconcile completed",
      });
    } catch (err) {
      console.error("Failed to reconcile billing:", err);
      setBillingMessage({ type: "error", text: "Billing reconcile failed" });
    } finally {
      setReconciling(false);
    }
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Checking authentication...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <DashboardLayout user={user} onLogout={handleLogout}>
        <div className="text-center py-12 text-slate-500">
          Loading settings...
        </div>
      </DashboardLayout>
    );
  }

  if (error || !settings || !orgInfo) {
    return (
      <DashboardLayout user={user} onLogout={handleLogout}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error || "Failed to load settings"}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
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
        <div className="flex gap-4 border-b border-slate-200 pb-4">
          <div className="px-4 py-2 border-b-2 border-slate-900 text-slate-900 font-medium">
            General Settings
          </div>
          <a
            href="/dashboard/settings/security"
            className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            🔒 Security
          </a>
        </div>

        {/* Kill Switches Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Kill Switches
          </h2>
          <div className="space-y-4">
            {/* Widget Enabled */}
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-900">
                  Widget Enabled
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  When disabled, widget will not render on client pages
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, widgetEnabled: !settings.widgetEnabled })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.widgetEnabled ? "bg-green-600" : "bg-slate-300"
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
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-900">
                  Write Enabled
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  When disabled, all POST operations will be blocked
                </p>
                {!settings.writeEnabled && (
                  <p className="text-xs text-orange-600 font-medium mt-2">
                    ⚠️ Write operations will be blocked (read-only mode).
                  </p>
                )}
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, writeEnabled: !settings.writeEnabled })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.writeEnabled ? "bg-green-600" : "bg-slate-300"
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
                <label className="text-sm font-medium text-slate-900">
                  AI Enabled
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Enable or disable AI features (future use)
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, aiEnabled: !settings.aiEnabled })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.aiEnabled ? "bg-green-600" : "bg-slate-300"
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
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Data Retention Policy
          </h2>
          <div className="space-y-4">
            {/* Retention Days */}
            <div className="py-3 border-b border-slate-100">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Message Retention Days
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Messages older than this will be processed by retention policy (1-3650 days)
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
                className="w-full max-w-xs px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <p className="text-xs text-slate-500 mt-2">
                Current: {settings.messageRetentionDays} days (~
                {Math.floor(settings.messageRetentionDays / 365)} years)
              </p>
            </div>

            {/* Hard Delete */}
            <div className="py-3 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-900">
                    Hard Delete on Retention
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    When enabled: Permanently delete old messages<br />
                    When disabled: Redact content to &ldquo;[redacted]&rdquo; (soft delete)
                  </p>
                  {settings.hardDeleteOnRetention && (
                    <p className="text-xs text-red-600 font-medium mt-2">
                      ⚠️ Hard delete permanently removes messages. No recovery possible.
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
                    settings.hardDeleteOnRetention ? "bg-red-600" : "bg-slate-300"
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
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Last Retention Run
              </label>
              <p className="text-sm text-slate-600">
                {settings.lastRetentionRunAt
                  ? new Date(settings.lastRetentionRunAt).toLocaleString()
                  : "Never"}
              </p>
              {settings.lastRetentionRunAt && (
                <p className="text-xs text-slate-500 mt-1">
                  Retention job processes messages older than retention period
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Billing Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Billing
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
            <div className="text-slate-600">Loading billing...</div>
          ) : (
            <div className="space-y-4">
              {!billingInfo.stripeConfigured && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-900 text-sm">
                  Stripe not configured. Checkout/portal sessions will fail until env vars are set.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <div className="text-xs text-slate-500">Status</div>
                  <div className="text-lg font-semibold text-slate-900 capitalize">
                    {billingInfo.billing.billingStatus}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Cancel at period end:{" "}
                    {billingInfo.billing.cancelAtPeriodEnd ? "Yes" : "No"}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <div className="text-xs text-slate-500">Current Period End</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {billingInfo.billing.currentPeriodEnd
                      ? new Date(billingInfo.billing.currentPeriodEnd).toLocaleString()
                      : "-"}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Price ID: {billingInfo.billing.stripePriceId || "-"}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleStartSubscription}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
                  disabled={!billingInfo.stripeConfigured}
                >
                  Start Subscription
                </button>
                <button
                  onClick={handleManageBilling}
                  className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                  disabled={!billingInfo.stripeConfigured}
                >
                  Manage Billing
                </button>
                <button
                  onClick={handleBillingReconcile}
                  className="px-4 py-2 bg-blue-50 text-blue-900 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  disabled={reconciling}
                >
                  {reconciling ? "Reconciling..." : "Reconcile Billing Now"}
                </button>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between py-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-900">
                      Enforce Billing
                    </label>
                    <p className="text-xs text-slate-500 mt-1">
                      When enabled, unpaid or inactive subscriptions block writes after grace period.
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
                      billingInfo.billing.billingEnforced ? "bg-green-600" : "bg-slate-300"
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
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Grace Days
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
                    className="w-full max-w-xs px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    {hasBillingChanges ? (
                      <span className="text-orange-600 font-medium">
                        ⚠️ You have unsaved billing changes
                      </span>
                    ) : (
                      <span>No billing changes</span>
                    )}
                  </div>
                  <button
                    onClick={handleBillingSave}
                    disabled={!hasBillingChanges || billingSaving}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      hasBillingChanges && !billingSaving
                        ? "bg-slate-900 text-white hover:bg-slate-700"
                        : "bg-slate-300 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {billingSaving ? "Saving..." : "Save Billing"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 p-6">
          <div className="text-sm text-slate-600">
            {hasChanges ? (
              <span className="text-orange-600 font-medium">
                ⚠️ You have unsaved changes
              </span>
            ) : (
              <span>No changes</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              hasChanges && !saving
                ? "bg-slate-900 text-white hover:bg-slate-700"
                : "bg-slate-300 text-slate-500 cursor-not-allowed"
            }`}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            ℹ️ Important Notes
          </h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>
              • Kill switches take effect immediately for new requests
            </li>
            <li>
              • Retention policy runs on schedule (manual execution via API)
            </li>
            <li>
              • Hard delete is permanent - consider soft delete for audit trails
            </li>
            <li>
              • Widget settings are cached by clients (may take up to 5 minutes to update)
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
