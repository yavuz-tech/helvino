"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkOrgAuth, orgLogout, orgApiFetch, type OrgUser } from "@/lib/org-auth";
import OrgPortalLayout from "@/components/OrgPortalLayout";
import { Copy, Check, Plus, X } from "lucide-react";
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

export default function OrgSecurityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<OrgUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [originalSecurity, setOriginalSecurity] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      const user = await checkOrgAuth();
      if (!user) {
        router.push("/org-app/login");
        return;
      }
      setUser(user);
      setAuthLoading(false);
    };
    verifyAuth();
  }, [router]);

  useEffect(() => {
    if (authLoading) return;

    const fetchSecurity = async () => {
      try {
        const response = await orgApiFetch("/org/security");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setOrgInfo(data.org);
        setSecurity(data.security);
        setOriginalSecurity(data.security);
      } catch (err) {
        console.error("Failed to fetch security settings:", err);
        setError(t("app.failedLoadSecurity"));
      } finally {
        setLoading(false);
      }
    };

    fetchSecurity();
  }, [authLoading, t]);

  const handleLogout = async () => {
    await orgLogout();
    router.push("/app/login");
  };

  const copySiteId = () => {
    if (security) {
      navigator.clipboard.writeText(security.siteId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddDomain = () => {
    if (!security) return;
    setSecurity({
      ...security,
      allowedDomains: [...security.allowedDomains, ""],
    });
  };

  const handleRemoveDomain = (index: number) => {
    if (!security) return;
    setSecurity({
      ...security,
      allowedDomains: security.allowedDomains.filter((_, i) => i !== index),
    });
  };

  const handleDomainChange = (index: number, value: string) => {
    if (!security) return;
    const newDomains = [...security.allowedDomains];
    newDomains[index] = value;
    setSecurity({
      ...security,
      allowedDomains: newDomains,
    });
  };

  const handleSave = async () => {
    if (!security || !originalSecurity) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const domainsChanged =
        JSON.stringify(security.allowedDomains.sort()) !==
        JSON.stringify(originalSecurity.allowedDomains.sort());
      const localhostChanged =
        security.allowLocalhost !== originalSecurity.allowLocalhost;

      if (!domainsChanged && !localhostChanged) {
        setSaveMessage({ type: "success", text: t("app.noChangesToSave") });
        setTimeout(() => setSaveMessage(null), 3000);
        setSaving(false);
        return;
      }

      const response = await orgApiFetch("/org/security", {
        method: "PATCH",
        body: JSON.stringify({
          allowedDomains: security.allowedDomains.filter((d) => d.trim().length > 0),
          allowLocalhost: security.allowLocalhost,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSecurity(data.security);
      setOriginalSecurity(data.security);
      setSaveMessage({ type: "success", text: t("app.securitySaved") });

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save security:", err);
      setSaveMessage({ type: "error", text: t("app.failedSaveSecurity") });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = security && originalSecurity && (
    JSON.stringify(security.allowedDomains.sort()) !==
      JSON.stringify(originalSecurity.allowedDomains.sort()) ||
    security.allowLocalhost !== originalSecurity.allowLocalhost
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
        <div className="text-[#475569]">{t("common.checkingAuth")}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <OrgPortalLayout user={user} onLogout={handleLogout}>
        <div className="text-center py-12 text-[#64748B]">
          {t("security.loadingSettings")}
        </div>
      </OrgPortalLayout>
    );
  }

  if (error || !security || !orgInfo) {
    return (
      <OrgPortalLayout user={user} onLogout={handleLogout}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error || t("app.failedLoadSecurity")}
        </div>
      </OrgPortalLayout>
    );
  }

  return (
    <OrgPortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1D23]">{t("app.securitySettings")}</h1>
        <p className="text-sm text-[#64748B] mt-1">
          {t("app.securitySubtitle")}
        </p>
      </div>

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

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <h2 className="text-lg font-semibold text-[#1A1D23] mb-4">{t("security.siteId")}</h2>
          <p className="text-sm text-[#475569] mb-4">
            {t("app.siteIdDesc")}
          </p>
          <div className="flex gap-2">
            <code className="flex-1 px-4 py-2 bg-amber-50/50 rounded border border-[#F3E8D8] text-sm font-mono">
              {security.siteId}
            </code>
            <button
              onClick={copySiteId}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={16} />
                  {t("security.copied")}
                </>
              ) : (
                <>
                  <Copy size={16} />
                  {t("security.copy")}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <h2 className="text-lg font-semibold text-[#1A1D23] mb-4">{t("security.allowedDomains")}</h2>
          <p className="text-sm text-[#475569] mb-4">
            {t("app.allowedDomainsDesc")}
          </p>

          <div className="space-y-2 mb-4">
            {security.allowedDomains.length === 0 ? (
              <div className="text-sm text-[#64748B] text-center py-4">
                {t("app.noDomains")}
              </div>
            ) : (
              security.allowedDomains.map((domain, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => handleDomainChange(index, e.target.value)}
                    placeholder="example.com or *.example.com"
                    className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono text-sm"
                  />
                  <button
                    onClick={() => handleRemoveDomain(index)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            onClick={handleAddDomain}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-900 rounded-lg hover:bg-amber-200 transition-colors"
          >
            <Plus size={16} />
            {t("app.addDomain")}
          </button>
        </div>

        <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#1A1D23] mb-1">
                {t("security.allowLocalhost")}
              </h3>
              <p className="text-sm text-[#475569]">
                {t("app.allowLocalhostDesc")}
              </p>
            </div>
            <input
              type="checkbox"
              checked={security.allowLocalhost}
              onChange={(e) => setSecurity({ ...security, allowLocalhost: e.target.checked })}
              className="w-12 h-6 rounded-full appearance-none bg-amber-200 relative cursor-pointer transition-colors checked:bg-green-500"
              style={{
                WebkitAppearance: "none",
              }}
            />
          </div>
        </div>

        <div>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors disabled:from-amber-300 disabled:to-amber-300"
          >
            {saving ? t("common.saving") : hasChanges ? t("app.saveSecuritySettings") : t("common.noChanges")}
          </button>
        </div>
      </div>
    </OrgPortalLayout>
  );
}
