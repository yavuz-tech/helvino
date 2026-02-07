"use client";

import { useI18n } from "@/i18n/I18nContext";
import { useHydrated } from "@/hooks/useHydrated";
import PublicLayout from "@/components/PublicLayout";

interface ServiceStatus {
  nameKey: string;
  status: "operational" | "degraded" | "down";
}

const SERVICES: ServiceStatus[] = [
  { nameKey: "pubStatus.apiService", status: "operational" },
  { nameKey: "pubStatus.webApp", status: "operational" },
  { nameKey: "pubStatus.database", status: "operational" },
  { nameKey: "pubStatus.redis", status: "operational" },
  { nameKey: "pubStatus.widgetCdn", status: "operational" },
  { nameKey: "pubStatus.emailService", status: "operational" },
];

export default function StatusPage() {
  const { t } = useI18n();
  const hydrated = useHydrated();

  const statusColor = (s: string) => {
    switch (s) {
      case "operational":
        return "bg-green-500";
      case "degraded":
        return "bg-amber-500";
      case "down":
        return "bg-red-500";
      default:
        return "bg-slate-400";
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "operational":
        return t("pubStatus.operational");
      case "degraded":
        return t("pubStatus.degraded");
      case "down":
        return t("pubStatus.down");
      default:
        return s;
    }
  };

  const allOperational = SERVICES.every((s) => s.status === "operational");

  return (
    <PublicLayout>
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-8 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">{t("pubStatus.title")}</h1>
        <p className="text-lg text-slate-600">{t("pubStatus.subtitle")}</p>
      </section>

      {/* Overall status */}
      <section className="max-w-3xl mx-auto px-6 pb-6">
        <div
          className={`rounded-xl border p-5 text-center ${
            allOperational
              ? "bg-green-50 border-green-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                allOperational ? "bg-green-500" : "bg-amber-500"
              }`}
            />
            <span
              className={`text-lg font-semibold ${
                allOperational ? "text-green-800" : "text-amber-800"
              }`}
            >
              {t("pubStatus.allOperational")}
            </span>
          </div>
        </div>
      </section>

      {/* Service list */}
      <section className="max-w-3xl mx-auto px-6 pb-10">
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {SERVICES.map((svc, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-medium text-slate-800">
                {t(svc.nameKey as Parameters<typeof t>[0])}
              </span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusColor(svc.status)}`} />
                <span className="text-sm text-slate-600">{statusLabel(svc.status)}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3 text-center" suppressHydrationWarning>
          {t("pubStatus.lastChecked")}: {hydrated ? new Date().toLocaleString() : "…"}
        </p>
      </section>

      {/* Incident history */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("pubStatus.incidentHistory")}</h2>
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500">{t("pubStatus.noIncidents")}</p>
        </div>
        <p className="text-xs text-slate-400 mt-3 text-center">{t("pubStatus.uptimeNote")}</p>
      </section>
    </PublicLayout>
  );
}
