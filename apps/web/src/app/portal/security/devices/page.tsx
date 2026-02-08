"use client";

import { useEffect, useState, useCallback } from "react";
import DeviceList from "@/components/DeviceList";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useStepUp } from "@/contexts/StepUpContext";

interface Device {
  id: string;
  userAgentRaw: string | null;
  label: string | null;
  trusted: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastIp: string | null;
}

export default function PortalDevicesPage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const { withStepUp } = useStepUp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDevices = useCallback(async () => {
    try {
      const res = await portalApiFetch("/portal/security/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) loadDevices();
  }, [user, loadDevices]);

  if (authLoading || !user) return null;

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("devices.title")}</h1>
          <p className="text-sm text-slate-600 mt-1">{t("devices.description")}</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        ) : (
          <DeviceList
            devices={devices}
            onTrust={async (id, trusted) => {
              const result = await withStepUp(() =>
                portalApiFetch(`/portal/security/devices/${id}/trust`, {
                  method: "PATCH",
                  body: JSON.stringify({ trusted }),
                }),
                "portal"
              );
              return result.ok;
            }}
            onRename={async (id, label) => {
              const res = await portalApiFetch(`/portal/security/devices/${id}/label`, {
                method: "PATCH",
                body: JSON.stringify({ label }),
              });
              return res.ok;
            }}
            onRemove={async (id) => {
              const result = await withStepUp(() =>
                portalApiFetch(`/portal/security/devices/${id}`, {
                  method: "DELETE",
                }),
                "portal"
              );
              return result.ok;
            }}
            onRefresh={loadDevices}
          />
        )}
      </div>
    </>
  );
}
