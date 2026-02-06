"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkOrgAuth, orgLogout, orgApiFetch, type OrgUser } from "@/lib/org-auth";
import OrgPortalLayout from "@/components/OrgPortalLayout";

interface OrgSettings {
  widgetEnabled: boolean;
  writeEnabled: boolean;
  aiEnabled: boolean;
  primaryColor: string | null;
  widgetName: string;
  widgetSubtitle: string;
  language: string;
  launcherText: string | null;
  position: string;
  messageRetentionDays: number;
  hardDeleteOnRetention: boolean;
  lastRetentionRunAt: string | null;
}

interface OrgInfo {
  id: string;
  key: string;
  name: string;
}

export default function OrgSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<OrgUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check authentication on mount
  useEffect(() => {
    const verifyAuth = async () => {
      const user = await checkOrgAuth();
      if (!user) {
        router.push("/app/login");
        return;
      }
      setUser(user);
      setAuthLoading(false);
    };
    verifyAuth();
  }, [router]);

  // Fetch current settings
  useEffect(() => {
    if (authLoading) return;

    const fetchSettings = async () => {
      try {
        const response = await orgApiFetch("/org/settings");

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
  }, [authLoading]);

  const handleLogout = async () => {
    await orgLogout();
    router.push("/app/login");
  };

  // Save settings (only branding fields)
  const handleSave = async () => {
    if (!settings || !originalSettings) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const updates: Partial<OrgSettings> = {};
      
      if (settings.widgetName !== originalSettings.widgetName) {
        updates.widgetName = settings.widgetName;
      }
      if (settings.widgetSubtitle !== originalSettings.widgetSubtitle) {
        updates.widgetSubtitle = settings.widgetSubtitle;
      }
      if (settings.primaryColor !== originalSettings.primaryColor) {
        updates.primaryColor = settings.primaryColor;
      }
      if (settings.language !== originalSettings.language) {
        updates.language = settings.language;
      }
      if (settings.launcherText !== originalSettings.launcherText) {
        updates.launcherText = settings.launcherText;
      }
      if (settings.position !== originalSettings.position) {
        updates.position = settings.position;
      }

      if (Object.keys(updates).length === 0) {
        setSaveMessage({ type: "success", text: "No changes to save" });
        setTimeout(() => setSaveMessage(null), 3000);
        setSaving(false);
        return;
      }

      const response = await orgApiFetch("/org/settings", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSettings(data.settings);
      setOriginalSettings(data.settings);
      setSaveMessage({ type: "success", text: "Settings saved successfully" });

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setSaveMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = settings && originalSettings && (
    settings.widgetName !== originalSettings.widgetName ||
    settings.widgetSubtitle !== originalSettings.widgetSubtitle ||
    settings.primaryColor !== originalSettings.primaryColor ||
    settings.language !== originalSettings.language ||
    settings.launcherText !== originalSettings.launcherText ||
    settings.position !== originalSettings.position
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Checking authentication...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <OrgPortalLayout user={user} onLogout={handleLogout}>
        <div className="text-center py-12 text-slate-500">
          Loading settings...
        </div>
      </OrgPortalLayout>
    );
  }

  if (error || !settings || !orgInfo) {
    return (
      <OrgPortalLayout user={user} onLogout={handleLogout}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error || "Failed to load settings"}
        </div>
      </OrgPortalLayout>
    );
  }

  return (
    <OrgPortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Widget Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Customize your widget appearance
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

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        {/* Widget Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Widget Name
          </label>
          <input
            type="text"
            value={settings.widgetName}
            onChange={(e) => setSettings({ ...settings, widgetName: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Support Chat"
          />
        </div>

        {/* Widget Subtitle */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Widget Subtitle
          </label>
          <input
            type="text"
            value={settings.widgetSubtitle}
            onChange={(e) => setSettings({ ...settings, widgetSubtitle: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="We're here to help"
          />
        </div>

        {/* Primary Color */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Primary Color
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={settings.primaryColor || "#0F5C5C"}
              onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              className="w-20 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={settings.primaryColor || "#0F5C5C"}
              onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-sm"
              placeholder="#0F5C5C"
            />
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Language
          </label>
          <select
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
          </select>
        </div>

        {/* Position */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Widget Position
          </label>
          <div className="flex gap-3">
            <label className="flex-1 flex items-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer hover:border-slate-400 transition-colors">
              <input
                type="radio"
                value="right"
                checked={settings.position === "right"}
                onChange={(e) => setSettings({ ...settings, position: e.target.value })}
                className="w-4 h-4"
              />
              <span className="text-sm">Right</span>
            </label>
            <label className="flex-1 flex items-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer hover:border-slate-400 transition-colors">
              <input
                type="radio"
                value="left"
                checked={settings.position === "left"}
                onChange={(e) => setSettings({ ...settings, position: e.target.value })}
                className="w-4 h-4"
              />
              <span className="text-sm">Left</span>
            </label>
          </div>
        </div>

        {/* Read-only status info */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Status</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-2xl mb-1 ${settings.widgetEnabled ? "text-green-600" : "text-red-600"}`}>
                {settings.widgetEnabled ? "✓" : "✗"}
              </div>
              <p className="text-xs text-slate-600">Widget</p>
            </div>
            <div className="text-center">
              <div className={`text-2xl mb-1 ${settings.writeEnabled ? "text-green-600" : "text-red-600"}`}>
                {settings.writeEnabled ? "✓" : "✗"}
              </div>
              <p className="text-xs text-slate-600">Write</p>
            </div>
            <div className="text-center">
              <div className={`text-2xl mb-1 ${settings.aiEnabled ? "text-green-600" : "text-red-600"}`}>
                {settings.aiEnabled ? "✓" : "✗"}
              </div>
              <p className="text-xs text-slate-600">AI</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center mt-3">
            Contact support to change these settings
          </p>
        </div>

        {/* Save Button */}
        <div className="pt-6">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
          >
            {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
          </button>
        </div>
      </div>
    </OrgPortalLayout>
  );
}
