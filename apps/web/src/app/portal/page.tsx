"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkPortalAuth,
  portalLogout,
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
import PortalLayout from "@/components/PortalLayout";
import { Copy, Check } from "lucide-react";

interface OrgInfo {
  id: string;
  key: string;
  name: string;
  siteId: string;
  allowLocalhost: boolean;
  allowedDomains: string[];
  widgetEnabled: boolean;
  writeEnabled: boolean;
  aiEnabled: boolean;
  messageRetentionDays: number;
  hardDeleteOnRetention: boolean;
}

export default function PortalOverviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const loadOrg = async () => {
      const res = await portalApiFetch("/portal/org/me");
      if (!res.ok) {
        setError("Failed to load organization");
        return;
      }
      const data = await res.json();
      setOrg(data.org);
    };
    loadOrg();
  }, [authLoading]);

  const handleLogout = async () => {
    await portalLogout();
    router.push("/portal/login");
  };

  const embedSnippet = org
    ? `<!-- Helvino Chat Widget -->\n<script>window.HELVINO_SITE_ID=\"${org.siteId}\";</script>\n<script src=\"https://cdn.helvino.io/embed.js\"></script>`
    : "";

  const copySnippet = async () => {
    if (!embedSnippet) return;
    await navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <PortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-600 mt-1">
          Your organization portal and embed setup
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {org && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Organization
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Name</span>
                <span className="font-medium">{org.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Key</span>
                <span className="font-mono">{org.key}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Site ID</span>
                <span className="font-mono">{org.siteId}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Embed Snippet
                </h2>
                <p className="text-sm text-slate-600">
                  Paste before the closing &lt;/body&gt; tag
                </p>
              </div>
              <button
                onClick={copySnippet}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-50 px-4 py-3 rounded text-xs overflow-x-auto">
              <code>{embedSnippet}</code>
            </pre>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
