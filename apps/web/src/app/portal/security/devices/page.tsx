"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/PortalLayout";
import DeviceList from "@/components/DeviceList";
import {
  checkPortalAuth,
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
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
  const router = useRouter();
  const { t } = useI18n();
  const { withStepUp } = useStepUp();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const u = await checkPortalAuth();
      if (!u) { router.push("/portal/login"); return; }
      setUser(u);
    };
    verify();
  }, [router]);

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

  if (!user) return null;

  return (
    <PortalLayout user={user} onLogout={() => router.push("/portal/login")}>
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
    </PortalLayout>
  );
}
