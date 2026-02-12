"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";

type ApiKeyRow = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type OrgMePayload = {
  org?: { planKey?: string | null };
};

export default function PortalSettingsApiKeysPage() {
  const { t } = useI18n();
  const [planKey, setPlanKey] = useState("free");
  const [items, setItems] = useState<ApiKeyRow[]>([]);

  useEffect(() => {
    portalApiFetch("/portal/org/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OrgMePayload | null) => {
        setPlanKey(String(data?.org?.planKey ?? "free").toLowerCase());
      })
      .catch(() => {});
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
        badge="PRO"
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
              {t("settings.proRequired")}
            </p>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>
              {t("settings.apiKeys.businessRequired")}
            </p>
            <Link
              href="/portal/billing"
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
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            transform: "scale(1)",
            transition: "transform .2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <Plus size={14} />
          {t("settings.apiKeys.create")}
        </button>

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

        {items.length === 0 ? (
          <div style={{ marginTop: 20, textAlign: "center", color: "#64748B", padding: "20px 10px" }}>
            <p style={{ fontSize: 28, marginBottom: 6 }}>🔑</p>
            <p style={{ fontSize: 14, fontWeight: 600 }}>{t("settings.apiKeys.empty")}</p>
          </div>
        ) : (
          <div className="space-y-3" style={{ marginTop: 14 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #F3E8D8",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1D23" }}>{item.name}</p>
                  <p style={{ fontSize: 12, color: "#94A3B8" }} suppressHydrationWarning>
                    {t("settings.apiKeys.createdAt")}: {new Date(item.createdAt).toLocaleDateString()} •{" "}
                    {t("settings.apiKeys.lastUsedAt")}:{" "}
                    {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString() : "-"}
                  </p>
                </div>
                <button
                  type="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#FFF1F2",
                    border: "1px solid #FECDD3",
                    color: "#E11D48",
                    borderRadius: 10,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Trash2 size={13} />
                  {t("common.delete")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
