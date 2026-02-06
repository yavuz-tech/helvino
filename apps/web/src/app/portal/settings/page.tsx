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

interface Settings {
  widgetEnabled: boolean;
  writeEnabled: boolean;
  aiEnabled: boolean;
  messageRetentionDays: number;
  hardDeleteOnRetention: boolean;
  lastRetentionRunAt: string | null;
}

export default function PortalSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [original, setOriginal] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canEdit = user?.role === "owner" || user?.role === "admin";

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
      const res = await portalApiFetch("/portal/org/me");
      if (!res.ok) {
        setMessage("Failed to load settings");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const next: Settings = {
        widgetEnabled: data.org.widgetEnabled,
        writeEnabled: data.org.writeEnabled,
        aiEnabled: data.org.aiEnabled,
        messageRetentionDays: data.org.messageRetentionDays,
        hardDeleteOnRetention: data.org.hardDeleteOnRetention,
        lastRetentionRunAt: data.org.lastRetentionRunAt,
      };
      setSettings(next);
      setOriginal(next);
      setLoading(false);
    };
    load();
  }, [authLoading]);

  const handleLogout = async () => {
    await portalLogout();
    router.push("/portal/login");
  };

  const handleSave = async () => {
    if (!settings || !canEdit) return;
    setSaving(true);
    setMessage(null);

    const res = await portalApiFetch("/portal/org/me/settings", {
      method: "PATCH",
      body: JSON.stringify({
        widgetEnabled: settings.widgetEnabled,
        writeEnabled: settings.writeEnabled,
        aiEnabled: settings.aiEnabled,
        messageRetentionDays: settings.messageRetentionDays,
        hardDeleteOnRetention: settings.hardDeleteOnRetention,
      }),
    });

    if (!res.ok) {
      setMessage("Failed to save settings");
      setSaving(false);
      return;
    }

    const data = await res.json();
    const next: Settings = {
      widgetEnabled: data.settings.widgetEnabled,
      writeEnabled: data.settings.writeEnabled,
      aiEnabled: data.settings.aiEnabled,
      messageRetentionDays: data.settings.messageRetentionDays,
      hardDeleteOnRetention: data.settings.hardDeleteOnRetention,
      lastRetentionRunAt: data.settings.lastRetentionRunAt,
    };
    setSettings(next);
    setOriginal(next);
    setMessage("Settings saved");
    setSaving(false);
  };

  const hasChanges =
    settings &&
    original &&
    JSON.stringify(settings) !== JSON.stringify(original);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (loading || !settings) {
    return (
      <PortalLayout user={user} onLogout={handleLogout}>
        <div className="text-slate-600">Loading settings...</div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          Control widget access and retention
        </p>
      </div>

      {message && (
        <div className="mb-6 bg-slate-100 border border-slate-200 rounded-lg p-4 text-slate-800">
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center justify-between border rounded-lg p-4">
            <div>
              <div className="font-medium">Widget Enabled</div>
              <div className="text-xs text-slate-500">
                Allow widget to load
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.widgetEnabled}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings({ ...settings, widgetEnabled: e.target.checked })
              }
            />
          </label>
          <label className="flex items-center justify-between border rounded-lg p-4">
            <div>
              <div className="font-medium">Write Enabled</div>
              <div className="text-xs text-slate-500">
                Allow new messages
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.writeEnabled}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings({ ...settings, writeEnabled: e.target.checked })
              }
            />
          </label>
          <label className="flex items-center justify-between border rounded-lg p-4">
            <div>
              <div className="font-medium">AI Enabled</div>
              <div className="text-xs text-slate-500">
                Enable AI responses
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.aiEnabled}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings({ ...settings, aiEnabled: e.target.checked })
              }
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Message Retention Days
            </label>
            <input
              type="number"
              min={1}
              value={settings.messageRetentionDays}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  messageRetentionDays: Number(e.target.value),
                })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <label className="flex items-center justify-between border rounded-lg p-4">
            <div>
              <div className="font-medium">Hard Delete</div>
              <div className="text-xs text-slate-500">
                Delete messages instead of redacting
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.hardDeleteOnRetention}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  hardDeleteOnRetention: e.target.checked,
                })
              }
            />
          </label>
        </div>

        {settings.lastRetentionRunAt && (
          <div className="text-xs text-slate-500">
            Last retention run:{" "}
            {new Date(settings.lastRetentionRunAt).toLocaleString()}
          </div>
        )}

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        )}
      </div>
    </PortalLayout>
  );
}
