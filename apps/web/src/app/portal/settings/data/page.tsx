"use client";

import { useState } from "react";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { useI18n } from "@/i18n/I18nContext";

export default function PortalSettingsDataPage() {
  const { t } = useI18n();
  const [openConfirm, setOpenConfirm] = useState(false);

  return (
    <div className="space-y-5" style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader title={t("settings.dataManagement")} subtitle={t("settings.dataManagement.desc")} />

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #F3E8D8",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1A1D23", marginBottom: 10 }}>
          {t("settings.data.exportTitle")}
        </h3>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 14 }}>
          {t("settings.data.exportDesc")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            style={{
              border: "1px solid #F59E0B",
              color: "#D97706",
              background: "#FFFBEB",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Download size={14} />
            {t("settings.exportConversations")}
          </button>
          <button
            type="button"
            style={{
              border: "1px solid #F59E0B",
              color: "#D97706",
              background: "#FFFBEB",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Download size={14} />
            {t("settings.exportCustomers")}
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #F3E8D8",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1A1D23", marginBottom: 10 }}>
          {t("settings.data.privacyTitle")}
        </h3>
        <div
          style={{
            background: "#EFF6FF",
            border: "1px solid #DBEAFE",
            borderRadius: 12,
            padding: "12px 14px",
            color: "#D97706",
            fontSize: 13,
            display: "flex",
            gap: 8,
          }}
        >
          <span>💡</span>
          <span>{t("settings.data.privacyInfo")}</span>
        </div>
        <Link
          href="/compliance"
          style={{
            display: "inline-block",
            marginTop: 10,
            fontSize: 13,
            color: "#D97706",
            textDecoration: "underline",
            fontWeight: 600,
          }}
        >
          {t("settings.data.privacyLink")}
        </Link>
      </div>

      <div
        style={{
          background: "#FFF1F2",
          border: "1px solid #FECDD3",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#BE123C", marginBottom: 10 }}>
          ⚠️ {t("settings.dangerZone")}
        </h3>
        <p style={{ fontSize: 13, color: "#9F1239", marginBottom: 12 }}>
          {t("settings.data.deleteDesc")}
        </p>
        <button
          type="button"
          onClick={() => setOpenConfirm(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#FFF1F2",
            border: "1px solid #FECDD3",
            color: "#E11D48",
            borderRadius: 10,
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <Trash2 size={14} />
          {t("settings.deleteAccount")}
        </button>
      </div>

      {openConfirm && (
        <div
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(15,23,42,0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setOpenConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #FECDD3",
              padding: 20,
              boxShadow: "0 20px 45px rgba(15,23,42,0.2)",
            }}
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#FFF1F2", color: "#E11D48" }}>
              <AlertTriangle size={14} />
              {t("settings.dangerZone")}
            </div>
            <h4 style={{ fontSize: 18, fontWeight: 700, color: "#1A1D23" }}>{t("settings.deleteAccountConfirm")}</h4>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenConfirm(false)}
                style={{
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#475569",
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => setOpenConfirm(false)}
                style={{
                  borderRadius: 10,
                  border: "1px solid #FECDD3",
                  background: "#FFF1F2",
                  color: "#E11D48",
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {t("settings.deleteAccount")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
