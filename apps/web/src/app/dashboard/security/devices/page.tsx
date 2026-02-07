"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import DeviceList from "@/components/DeviceList";
import { checkAuth, type AdminUser } from "@/lib/auth";
import { useI18n } from "@/i18n/I18nContext";
import { useStepUp } from "@/contexts/StepUpContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Device {
  id: string;
  userAgentRaw: string | null;
  label: string | null;
  trusted: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastIp: string | null;
}

export default function AdminDevicesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { withStepUp } = useStepUp();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const u = await checkAuth();
      if (!u) { router.push("/login"); return; }
      setUser(u);
    };
    verify();
  }, [router]);

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/internal/security/devices`, {
        credentials: "include",
      });
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
    <DashboardLayout>
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
                fetch(`${API_URL}/internal/security/devices/${id}/trust`, {
                  method: "PATCH",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ trusted }),
                }),
                "admin"
              );
              return result.ok;
            }}
            onRename={async (id, label) => {
              const res = await fetch(`${API_URL}/internal/security/devices/${id}/label`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label }),
              });
              return res.ok;
            }}
            onRemove={async (id) => {
              const result = await withStepUp(() =>
                fetch(`${API_URL}/internal/security/devices/${id}`, {
                  method: "DELETE",
                  credentials: "include",
                }),
                "admin"
              );
              return result.ok;
            }}
            onRefresh={loadDevices}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
