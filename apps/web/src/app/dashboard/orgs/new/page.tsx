"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import { useOrg } from "@/contexts/OrgContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Copy, Check } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function NewOrgPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { createOrg } = useOrg();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [allowedDomainsText, setAllowedDomainsText] = useState("");
  const [allowLocalhost, setAllowLocalhost] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const websitePattern = /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
  const websitePatternText = "(https?:\\/\\/)?(www\\.)?[a-z0-9-]+(\\.[a-z0-9-]+)+";

  // Success state
  const [createdOrg, setCreatedOrg] = useState<{
    name: string;
    key: string;
    siteId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("orgs.orgNameRequired"));
      return;
    }
    if (!websitePattern.test(trimmedName)) {
      setError(t("validation.website"));
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse allowed domains (one per line, trim whitespace)
      const allowedDomains = allowedDomainsText
        .split("\n")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      const org = await createOrg({
        name: trimmedName,
        allowedDomains: allowedDomains.length > 0 ? allowedDomains : undefined,
        allowLocalhost,
      });

      setCreatedOrg(org);
    } catch (err) {
      console.error("Failed to create organization:", err);
      setError(err instanceof Error ? err.message : t("orgs.failedCreate"));
      setIsSubmitting(false);
    }
  };

  const embedSnippet = createdOrg
    ? `<!-- Helvion Chat Widget -->
<script>window.HELVION_SITE_ID="${createdOrg.siteId}";</script>
<script src="https://api.helvion.io/embed.js"></script>`
    : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
        <div className="text-[#475569]">{t("common.loading")}</div>
      </div>
    );
  }

  // Show success state
  if (createdOrg) {
    return (
      <DashboardLayout user={user} onLogout={handleLogout}>
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg border border-[#F3E8D8] p-8">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-2xl font-bold text-[#1A1D23] font-heading mb-2">
                {t("orgs.orgCreated")}
              </h1>
              <p className="text-[#475569]">
                <strong>{createdOrg.name}</strong> {t("orgs.readyToUse")}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1">
                  {t("orgs.orgKeyLabel")}
                </label>
                <code className="block px-4 py-2 bg-amber-50/50 rounded border border-amber-200 text-sm font-mono">
                  {createdOrg.key}
                </code>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1">
                  {t("orgs.siteIdPublic")}
                </label>
                <code className="block px-4 py-2 bg-amber-50/50 rounded border border-amber-200 text-sm font-mono">
                  {createdOrg.siteId}
                </code>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-amber-900 font-heading mb-1">
                    {t("orgs.embedSnippet")}
                  </h3>
                  <p className="text-sm text-amber-800">
                    {t("orgs.embedHint")}
                  </p>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:opacity-90 transition-colors text-sm"
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
              <pre className="bg-[#1A1D23] text-amber-50 px-4 py-3 rounded text-xs overflow-x-auto">
                <code>{embedSnippet}</code>
              </pre>
            </div>

            <div className="flex gap-3">
              <a
                href="/dashboard"
                className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-center rounded-lg hover:opacity-90 transition-colors"
              >
                {t("orgs.goToDashboard")}
              </a>
              <a
                href="/dashboard/settings"
                className="flex-1 px-4 py-2 bg-amber-50 text-amber-900 text-center rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors"
              >
                {t("orgs.configureSettings")}
              </a>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show form
  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1A1D23] font-heading mb-2">
            {t("orgs.createTitle")}
          </h1>
          <p className="text-[#475569]">
            {t("orgs.createOrgSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-[#F3E8D8] p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Website */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-[#334155] mb-2"
              >
                {t("orgs.orgNameLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onInvalid={(e) => e.currentTarget.setCustomValidity(t("validation.website"))}
                onInput={(e) => e.currentTarget.setCustomValidity("")}
                placeholder={t("orgs.orgNamePlaceholder")}
                className="w-full px-4 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
                pattern={websitePatternText}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-[#64748B]">{t("validation.websiteHint")}</p>
              <p className="mt-1 text-xs text-[#64748B]">
                {t("orgs.autoKeyHint")}
              </p>
            </div>

            {/* Allowed Domains */}
            <div>
              <label
                htmlFor="domains"
                className="block text-sm font-medium text-[#334155] mb-2"
              >
                {t("orgs.allowedDomainsOptional")}
              </label>
              <textarea
                id="domains"
                value={allowedDomainsText}
                onChange={(e) => setAllowedDomainsText(e.target.value)}
                placeholder="example.com&#10;*.example.com&#10;app.example.com"
                rows={4}
                className="w-full px-4 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono text-sm"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-[#64748B]">
                {t("orgs.domainPerLine")}
              </p>
            </div>

            {/* Allow Localhost */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="localhost"
                checked={allowLocalhost}
                onChange={(e) => setAllowLocalhost(e.target.checked)}
                className="w-4 h-4 text-amber-600 border-amber-200 rounded focus:ring-amber-500/20"
                disabled={isSubmitting}
              />
              <label htmlFor="localhost" className="text-sm text-[#334155]">
                {t("orgs.allowLocalhostDev")}
              </label>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex-1 px-4 py-2 bg-amber-50 text-amber-900 rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors"
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("orgs.creating") : t("orgs.createTitle")}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
