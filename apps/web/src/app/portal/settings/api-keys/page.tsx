"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { useI18n } from "@/i18n/I18nContext";
import { fetchOrgFeatures } from "@/lib/org-features";

export default function PortalSettingsApiKeysPage() {
  const { t } = useI18n();
  const [planKey, setPlanKey] = useState("free");

  useEffect(() => {
    let cancelled = false;
    fetchOrgFeatures()
      .then((f) => {
        if (cancelled) return;
        setPlanKey(String(f.planKey ?? "free").toLowerCase());
      })
      .catch(() => setPlanKey("free"));
    return () => {
      cancelled = true;
    };
  }, []);

  const businessPlus = useMemo(
    () => ["business", "enterprise", "unlimited"].includes(planKey),
    [planKey]
  );

  return (
    <div className="space-y-5" style={{ background: "#FFFBF5", borderRadius: 16, padding: 16, position: "relative" }}>
      <PageHeader
        title={t("settings.apiKeys")}
        subtitle={t("settings.apiKeys.desc")}
        badge="BUSINESS"
      />

      {!businessPlus && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(1px)",
            zIndex: 20,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #F3E8D8",
              borderRadius: 16,
              padding: 24,
              textAlign: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              maxWidth: 440,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 8 }}>🔒</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1D23", marginBottom: 6 }}>
              {t("settings.apiKeys.businessRequired")}
            </p>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>
              {t("settings.apiKeys.businessRequired")}
            </p>
            <Link
              href="/portal/pricing"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {t("billing.viewPlans")}
            </Link>
          </div>
        </div>
      )}

      <div
        style={{
          opacity: businessPlus ? 1 : 0.5,
          pointerEvents: businessPlus ? "auto" : "none",
          background: "#FFFFFF",
          border: "1px solid #F3E8D8",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 800, color: "#1A1D23" }}>{t("settings.comingSoon")}</p>
          <span
            style={{
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              color: "#fff",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.02em",
            }}
          >
            {t("pricingV2.soon")}
          </span>
        </div>

        <div
          style={{
            marginTop: 14,
            background: "#EFF6FF",
            border: "1px solid #DBEAFE",
            borderRadius: 12,
            padding: "12px 14px",
            color: "#D97706",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>💡</span>
          <span>{t("settings.apiKeys.keepSecret")}</span>
        </div>

        <div style={{ marginTop: 14, color: "#64748B", fontSize: 13, lineHeight: 1.5 }}>
          {t("settings.apiKeys.empty")}
        </div>
      </div>
    </div>
  );
}
