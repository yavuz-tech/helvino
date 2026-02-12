"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import { useOrg } from "@/contexts/OrgContext";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/i18n/I18nContext";

interface SecuritySettings {
  siteId: string;
  allowedDomains: string[];
  allowLocalhost: boolean;
}

interface OrgInfo {
  id: string;
  key: string;
  name: string;
}

export default function SecurityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [originalSecurity, setOriginalSecurity] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Rotate state
  const [rotateInput, setRotateInput] = useState("");
  const [rotating, setRotating] = useState(false);

  // Copy state
  const [copied, setCopied] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const { selectedOrg, isLoading: orgLoading } = useOrg();

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

  // Fetch current security settings
  useEffect(() => {
    if (authLoading || orgLoading || !selectedOrg) return;

    const fetchSecurity = async () => {
      try {
        const response = await fetch(`${API_URL}/api/org/${selectedOrg.key}/security`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setOrgInfo(data.org);
        setSecurity(data.security);
        setOriginalSecurity(data.security);
      } catch (err) {
        console.error("Failed to fetch security settings:", err);
        setError(t("security.failedLoadSettings"));
      } finally {
        setLoading(false);
      }
    };

    fetchSecurity();
  }, [API_URL, selectedOrg, authLoading, orgLoading, t]);

  // Save security settings
  const handleSave = async () => {
    if (!security || !originalSecurity || !selectedOrg) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      // Build update payload
      const updates: Partial<SecuritySettings> = {};

      // Check for changes
      const domainsChanged =
        JSON.stringify(security.allowedDomains.sort()) !==
        JSON.stringify(originalSecurity.allowedDomains.sort());

      if (domainsChanged) {
        // Validate and clean domains
        const cleaned = security.allowedDomains
          .map((d) => d.trim())
          .filter((d) => d.length > 0);

        // Deduplicate
        const unique = [...new Set(cleaned)];

        // Validate count
        if (unique.length > 100) {
          setSaveMessage({ type: "error", text: t("security.maxDomainsError") });
          setSaving(false);
          return;
        }

        updates.allowedDomains = unique;
      }

      if (security.allowLocalhost !== originalSecurity.allowLocalhost) {
        updates.allowLocalhost = security.allowLocalhost;
      }

      // Only send PATCH if there are changes
      if (Object.keys(updates).length === 0) {
        setSaveMessage({ type: "success", text: t("common.noChanges") });
        setTimeout(() => setSaveMessage(null), 3000);
        setSaving(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/org/${selectedOrg.key}/security`, {
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
      setSecurity(data.security);
      setOriginalSecurity(data.security);
      setSaveMessage({ type: "success", text: t("security.saved") });

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save security settings:", err);
      setSaveMessage({ type: "error", text: t("security.failedSave") });
    } finally {
      setSaving(false);
    }
  };

  // Rotate site ID
  const handleRotate = async () => {
    if (rotateInput !== "ROTATE" || !selectedOrg) return;

    setRotating(true);
    setSaveMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/org/${selectedOrg.key}/security/rotate-site-id`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Update displayed siteId
      if (security) {
        const newSecurity = { ...security, siteId: data.security.siteId };
        setSecurity(newSecurity);
        setOriginalSecurity(newSecurity);
      }

      setSaveMessage({
        type: "success",
        text: `${t("security.siteIdRotated")}. ${t("security.oldSiteId")} ${data.security.oldSiteId}`,
      });

      setRotateInput("");
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (err) {
      console.error("Failed to rotate site ID:", err);
      setSaveMessage({ type: "error", text: t("security.failedRotate") });
    } finally {
      setRotating(false);
    }
  };

  // Copy site ID to clipboard
  const handleCopy = async () => {
    if (!security) return;

    try {
      await navigator.clipboard.writeText(security.siteId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Add domain row
  const handleAddDomain = () => {
    if (!security) return;
    setSecurity({
      ...security,
      allowedDomains: [...security.allowedDomains, ""],
    });
  };

  // Remove domain row
  const handleRemoveDomain = (index: number) => {
    if (!security) return;
    setSecurity({
      ...security,
      allowedDomains: security.allowedDomains.filter((_, i) => i !== index),
    });
  };

  // Update domain value
  const handleDomainChange = (index: number, value: string) => {
    if (!security) return;
    const newDomains = [...security.allowedDomains];
    newDomains[index] = value;
    setSecurity({
      ...security,
      allowedDomains: newDomains,
    });
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Check if there are unsaved changes
  const hasChanges = security && originalSecurity && (
    JSON.stringify(security.allowedDomains.sort()) !==
      JSON.stringify(originalSecurity.allowedDomains.sort()) ||
    security.allowLocalhost !== originalSecurity.allowLocalhost
  );

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
        <div className="text-center py-12 text-[#64748B]">
          {t("security.loadingSettings")}
        </div>
      </DashboardLayout>
    );
  }

  if (error || !security || !orgInfo) {
    return (
      <DashboardLayout user={user} onLogout={handleLogout}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error || t("security.failedLoadSettings")}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1D23] font-heading">{t("nav.security")}</h1>
        <p className="text-sm text-[#64748B] mt-1">
          {orgInfo.name} ({orgInfo.key})
        </p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className="mb-6">
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

      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b border-[#F3E8D8] pb-4 mb-6">
        <a
          href="/dashboard/settings"
          className="px-4 py-2 text-[#475569] hover:text-amber-800 transition-colors"
        >
          {t("nav.generalSettings")}
        </a>
        <div className="px-4 py-2 border-b-2 border-amber-600 text-[#1A1D23] font-medium font-heading">
          🔒 {t("nav.security")}
        </div>
      </div>

      {/* Security Settings */}
      <div className="space-y-6">

        {/* Site ID Card */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <h2 className="text-lg font-semibold text-[#1A1D23] font-heading mb-4">
            {t("security.siteId")}
          </h2>
          <p className="text-sm text-[#475569] mb-4">
            {t("security.siteIdDesc")}
          </p>

          <div className="flex items-center gap-3 mb-4">
            <code className="flex-1 px-4 py-3 bg-amber-50/50 border border-amber-200 rounded-lg font-mono text-sm">
              {security.siteId}
            </code>
            <button
              onClick={handleCopy}
              className="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
            >
              {copied ? t("security.copied") : t("security.copy")}
            </button>
          </div>

          <div className="border-t border-amber-200 pt-4">
            <h3 className="text-sm font-semibold text-[#1A1D23] mb-2">
              {t("security.rotateSiteId")}
            </h3>
            <p className="text-xs text-[#475569] mb-3">
              {t("security.rotateSiteIdDesc")}
            </p>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={rotateInput}
                onChange={(e) => setRotateInput(e.target.value)}
                placeholder={t("security.rotateConfirmPlaceholder")}
                className="flex-1 px-4 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                onClick={handleRotate}
                disabled={rotateInput !== "ROTATE" || rotating}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  rotateInput === "ROTATE" && !rotating
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-amber-200 text-[#94A3B8] cursor-not-allowed"
                }`}
              >
                {rotating ? t("security.rotating") : t("security.rotate")}
              </button>
            </div>

            {rotateInput && rotateInput !== "ROTATE" && (
              <p className="text-xs text-orange-600 mt-2">
                {t("security.rotateHint")}
              </p>
            )}
          </div>
        </div>

        {/* Allowed Domains Card */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <h2 className="text-lg font-semibold text-[#1A1D23] font-heading mb-4">
            {t("security.allowedDomains")}
          </h2>
          <p className="text-sm text-[#475569] mb-4">
            {t("security.allowedDomainsDesc")}
          </p>

          <div className="space-y-2 mb-4">
            {security.allowedDomains.map((domain, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => handleDomainChange(index, e.target.value)}
                  placeholder="example.com or *.example.com"
                  className="flex-1 px-4 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <button
                  onClick={() => handleRemoveDomain(index)}
                  className="px-3 py-2 text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  {t("security.remove")}
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddDomain}
            disabled={security.allowedDomains.length >= 100}
            className="px-4 py-2 bg-amber-50 text-amber-900 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors disabled:bg-amber-50/50 disabled:text-[#94A3B8] disabled:cursor-not-allowed border border-amber-200"
          >
            + {t("security.addDomain")}
          </button>

          {security.allowedDomains.length >= 100 && (
            <p className="text-xs text-orange-600 mt-2">
              {t("security.maxDomainsReached")}
            </p>
          )}

          <div className="mt-4 text-xs text-[#64748B]">
            <p className="font-semibold mb-1">{t("security.examplesTitle")}</p>
            <ul className="list-disc list-inside space-y-1">
              <li><code>helvion.io</code> - {t("security.exampleExact")}</li>
              <li><code>*.helvion.io</code> - {t("security.exampleWildcard")}</li>
              <li><code>localhost:3000</code> - {t("security.examplePort")}</li>
            </ul>
          </div>
        </div>

        {/* Localhost Toggle */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#1A1D23]">
                {t("security.allowLocalhost")}
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                {t("security.allowLocalhostDesc")}
              </p>
            </div>
            <button
              onClick={() =>
                setSecurity({
                  ...security,
                  allowLocalhost: !security.allowLocalhost,
                })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                security.allowLocalhost ? "bg-green-600" : "bg-amber-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  security.allowLocalhost ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
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
            <li>• {t("security.note1")}</li>
            <li>• {t("security.note2")}</li>
            <li>• {t("security.note3")}</li>
            <li>• {t("security.note4")}</li>
            <li>• {t("security.note5")}</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
