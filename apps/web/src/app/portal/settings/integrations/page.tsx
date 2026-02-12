"use client";

import { Link2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";

type IntegrationCard = {
  nameKey: TranslationKey;
  emoji: string;
  descriptionKey: TranslationKey;
  tier: "PRO" | "BUSINESS";
};

const INTEGRATIONS: IntegrationCard[] = [
  { nameKey: "settings.integrations.whatsapp", emoji: "📱", descriptionKey: "settings.integrations.whatsapp.desc", tier: "PRO" },
  { nameKey: "settings.integrations.instagram", emoji: "📸", descriptionKey: "settings.integrations.instagram.desc", tier: "PRO" },
  { nameKey: "settings.integrations.shopify", emoji: "🛍️", descriptionKey: "settings.integrations.shopify.desc", tier: "BUSINESS" },
  { nameKey: "settings.integrations.woo", emoji: "🛒", descriptionKey: "settings.integrations.woo.desc", tier: "BUSINESS" },
  { nameKey: "settings.integrations.zapier", emoji: "⚡", descriptionKey: "settings.integrations.zapier.desc", tier: "BUSINESS" },
  { nameKey: "settings.integrations.make", emoji: "🔄", descriptionKey: "settings.integrations.make.desc", tier: "BUSINESS" },
];

export default function PortalSettingsIntegrationsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-5" style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader title={t("settings.integrations")} subtitle={t("settings.integrations.desc")} />

      <div
        style={{
          background: "#FEF3C7",
          border: "1px solid #F3E8D8",
          borderRadius: 12,
          padding: "12px 14px",
          fontSize: 13,
          color: "#1A1D23",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>💡</span>
        <span>{t("settings.comingSoon")}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((item) => (
          <div
            key={item.nameKey}
            style={{
              opacity: 0.7,
              pointerEvents: "none",
              background: "#FFFFFF",
              border: "1px solid #F3E8D8",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
              transition: "transform .2s ease, box-shadow .2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)";
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="inline-flex items-center gap-2">
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <h3 className="font-heading" style={{ fontSize: 16, fontWeight: 700, color: "#1A1D23" }}>{t(item.nameKey)}</h3>
              </div>
              <span
                style={{
                  background: item.tier === "PRO" ? "linear-gradient(135deg, #F59E0B, #D97706)" : "#F8FAFC",
                  color: item.tier === "PRO" ? "#fff" : "#64748B",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {item.tier}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>{t(item.descriptionKey)}</p>
            <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "#FEF3C7", color: "#D97706" }}>
              <Link2 size={12} />
              {t("settings.comingSoon")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
