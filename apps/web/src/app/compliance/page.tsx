"use client";

import { useI18n } from "@/i18n/I18nContext";

export default function CompliancePage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">{t("pubCompliance.title")}</h1>
        <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("pubCompliance.retentionTitle")}</h2>
            <p className="text-slate-600">{t("pubCompliance.retentionDesc")}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("pubCompliance.isolationTitle")}</h2>
            <p className="text-slate-600">{t("pubCompliance.isolationDesc")}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("pubCompliance.gdprTitle")}</h2>
            <p className="text-slate-600">{t("pubCompliance.gdprDesc")}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("pubCompliance.encryptionTitle")}</h2>
            <p className="text-slate-600">{t("pubCompliance.encryptionDesc")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
