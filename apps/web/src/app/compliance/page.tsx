"use client";

import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";

export default function CompliancePage() {
  const { t } = useI18n();

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-[#1A1D23] font-heading mb-6">{t("pubCompliance.title")}</h1>
        <div className="bg-white rounded-xl border border-[#F3E8D8] p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-[#1A1D23] font-heading mb-3">{t("pubCompliance.retentionTitle")}</h2>
            <p className="text-[#475569]">{t("pubCompliance.retentionDesc")}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#1A1D23] font-heading mb-3">{t("pubCompliance.isolationTitle")}</h2>
            <p className="text-[#475569]">{t("pubCompliance.isolationDesc")}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#1A1D23] font-heading mb-3">{t("pubCompliance.gdprTitle")}</h2>
            <p className="text-[#475569]">{t("pubCompliance.gdprDesc")}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#1A1D23] font-heading mb-3">{t("pubCompliance.encryptionTitle")}</h2>
            <p className="text-[#475569]">{t("pubCompliance.encryptionDesc")}</p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
