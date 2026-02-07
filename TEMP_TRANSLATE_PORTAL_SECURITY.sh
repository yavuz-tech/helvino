#!/bin/bash
# Temporary helper - will add useI18n and t() calls to portal/security.tsx
# Manual translation faster than multiple StrReplace calls

cat > /Users/yavuz/Desktop/helvino/apps/web/src/app/portal/security/page.tsx << 'EOF'
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/PortalLayout";
import {
  checkPortalAuth,
  portalLogout,
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
import { Copy, Check, Plus, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface SecuritySettings {
  siteId: string;
  allowedDomains: string[];
  allowLocalhost: boolean;
}

export default function PortalSecurityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [original, setOriginal] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rotateInput, setRotateInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const canEdit = user?.role === "owner" || user?.role === "admin";
  const canRotate = user?.role === "owner";

  useEffect(() => {
    const verify = async () => {
      const portalUser = await checkPortalAuth();
      if (!portalUser) {
        router.push("/portal/login");
        return;
      }
      setUser(portalUser);
      setAuthLoading(false);
    };
    verify();
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      const res = await portalApiFetch("/portal/org/me/security");
      if (!res.ok) {
        setMessage(t("portal.failedLoadSecurity"));
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSecurity(data.security);
      setOriginal(data.security);
      setLoading(false);
    };
    load();
  }, [authLoading, t]);

  const handleLogout = async () => {
    await portalLogout();
    router.push("/portal/login");
  };

  const copySiteId = async () => {
    if (!security) return;
    await navigator.clipboard.writeText(security.siteId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  const handleSave = async () => {
    if (!security || !original || !canEdit) return;
    setSaving(true);
    setMessage(null);

    const res = await portalApiFetch("/portal/org/me/security", {
      method: "PATCH",
      body: JSON.stringify({
        allowedDomains: security.allowedDomains.filter((d) => d.trim().length > 0),
        allowLocalhost: security.allowLocalhost,
      }),
    });

    if (!res.ok) {
      setMessage(t("portal.failedSaveSecurity"));
      setSaving(false);
      return;
    }

    const data = await res.json();
    setSecurity(data.security);
    setOriginal(data.security);
    setMessage(t("portal.securitySaved"));
    setSaving(false);
  };

  const handleRotate = async () => {
    if (!canRotate || rotateInput !== "ROTATE") return;
    setMessage(null);
    const res = await portalApiFetch("/portal/org/me/rotate-site-id", {
      method: "POST",
      body: JSON.stringify({ confirm: rotateInput }),
    });
    if (!res.ok) {
      setMessage(t("security.failedRotate"));
      return;
    }
    const data = await res.json();
    setSecurity(data.security);
    setOriginal(data.security);
    setRotateInput("");
    setMessage(t("portal.siteIdRotated"));
  };

  const hasChanges =
    security &&
    original &&
    (security.allowLocalhost !== original.allowLocalhost ||
      JSON.stringify([...security.allowedDomains].sort()) !==
        JSON.stringify([...original.allowedDomains].sort()));

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">{t("common.loading")}</div>
      </div>
    );
  }

  if (loading || !security) {
    return (
      <PortalLayout user={user} onLogout={handleLogout}>
        <div className="text-slate-600">{t("security.loadingSettings")}</div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("security.title")}</h1>
        <p className="text-sm text-slate-600 mt-1">
          {t("portal.securitySubtitle")}
        </p>
      </div>

      {message && (
        <div className="mb-6 bg-slate-100 border border-slate-200 rounded-lg p-4 text-slate-800">
          {message}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">{t("security.siteId")}</h2>
          <div className="flex gap-2">
            <code className="flex-1 px-4 py-2 bg-slate-50 rounded border border-slate-200 text-sm font-mono">
              {security.siteId}
            </code>
            <button
              onClick={copySiteId}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
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

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            {t("security.allowedDomains")}
          </h2>
          <div className="space-y-2 mb-4">
            {security.allowedDomains.map((domain, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => {
                    const next = [...security.allowedDomains];
                    next[index] = e.target.value;
                    setSecurity({ ...security, allowedDomains: next });
                  }}
                  disabled={!canEdit}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-sm disabled:bg-slate-100"
                />
                {canEdit && (
                  <button
                    onClick={() => handleRemoveDomain(index)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {canEdit && (
            <button
              onClick={handleAddDomain}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Plus size={16} />
              {t("security.addDomain")}
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                {t("security.allowLocalhost")}
              </h3>
              <p className="text-sm text-slate-600">
                {t("security.allowLocalhostDesc")}
              </p>
            </div>
            <input
              type="checkbox"
              checked={security.allowLocalhost}
              disabled={!canEdit}
              onChange={(e) =>
                setSecurity({ ...security, allowLocalhost: e.target.checked })
              }
              className="w-12 h-6 rounded-full appearance-none bg-slate-200 relative cursor-pointer transition-colors checked:bg-green-500 disabled:cursor-not-allowed"
              style={{ WebkitAppearance: "none" }}
            />
          </div>
        </div>

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
          >
            {saving ? t("common.saving") : t("portal.saveSecuritySettings")}
          </button>
        )}

        {canRotate && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              {t("portal.rotateSiteId")}
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              {t("portal.rotateSiteIdSubtitle")}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={rotateInput}
                onChange={(e) => setRotateInput(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="ROTATE"
              />
              <button
                onClick={handleRotate}
                disabled={rotateInput !== "ROTATE"}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300"
              >
                {t("portal.rotate")}
              </button>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
EOF
