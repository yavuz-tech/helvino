"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Monitor, Smartphone, Trash2, Shield, ShieldOff, Pencil } from "lucide-react";

interface Device {
  id: string;
  userAgentRaw: string | null;
  label: string | null;
  trusted: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastIp: string | null;
}

interface DeviceListProps {
  devices: Device[];
  onTrust: (id: string, trusted: boolean) => Promise<boolean>;
  onRename: (id: string, label: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onRefresh: () => void;
}

function getDeviceIcon(ua: string | null) {
  if (!ua) return Monitor;
  const lower = ua.toLowerCase();
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
    return Smartphone;
  }
  return Monitor;
}

function parseUA(ua: string | null, fallback: string = "Unknown"): string {
  if (!ua) return fallback;
  if (ua.length > 60) return ua.substring(0, 60) + "...";
  return ua;
}

export default function DeviceList({ devices, onTrust, onRename, onRemove, onRefresh }: DeviceListProps) {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (devices.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">{t("devices.noDevices")}</p>
    );
  }

  const handleRename = async (id: string) => {
    const ok = await onRename(id, editLabel);
    if (ok) {
      setEditingId(null);
      setEditLabel("");
      onRefresh();
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    const ok = await onRemove(id);
    if (ok) onRefresh();
    setRemovingId(null);
  };

  return (
    <div className="space-y-3">
      {devices.map((d) => {
        const Icon = getDeviceIcon(d.userAgentRaw);
        return (
          <div key={d.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Icon size={20} className="text-slate-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {editingId === d.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder={t("devices.label")}
                        className="px-2 py-1 border border-slate-300 rounded text-sm"
                        autoFocus
                        maxLength={100}
                      />
                      <button
                        onClick={() => handleRename(d.id)}
                        className="text-xs px-2 py-1 bg-slate-900 text-white rounded hover:bg-slate-700"
                      >
                        {t("common.save")}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs px-2 py-1 text-slate-600 hover:text-slate-900"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-sm text-slate-900">
                      {d.label || parseUA(d.userAgentRaw, t("devices.unknown"))}
                    </span>
                  )}
                  {d.trusted && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                      {t("devices.trusted")}
                    </span>
                  )}
                </div>
                {d.label && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{parseUA(d.userAgentRaw, t("devices.unknown"))}</p>
                )}
                <div className="flex gap-4 text-xs text-slate-400 mt-1">
                  <span suppressHydrationWarning>{t("devices.lastSeen")}: {new Date(d.lastSeenAt).toLocaleString()}</span>
                  {d.lastIp && <span>{t("devices.lastIp")}: {d.lastIp}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onTrust(d.id, !d.trusted).then((ok) => ok && onRefresh())}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  title={d.trusted ? t("devices.untrust") : t("devices.trust")}
                >
                  {d.trusted ? <ShieldOff size={16} /> : <Shield size={16} />}
                </button>
                <button
                  onClick={() => { setEditingId(d.id); setEditLabel(d.label || ""); }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  title={t("devices.rename")}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleRemove(d.id)}
                  disabled={removingId === d.id}
                  className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  title={t("devices.remove")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
