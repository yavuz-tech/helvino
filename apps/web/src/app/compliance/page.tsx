"use client";

import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";

export default function CompliancePage() {
  const { t } = useI18n();

  const sections = [
    {
      title: t("pubCompliance.gdprTitle"),
      desc: t("pubCompliance.gdprDesc"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: t("pubCompliance.isolationTitle"),
      desc: t("pubCompliance.isolationDesc"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      title: t("pubCompliance.retentionTitle"),
      desc: t("pubCompliance.retentionDesc"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: t("pubCompliance.recoveryTitle"),
      desc: t("pubCompliance.recoveryDesc"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      title: t("pubCompliance.encryptionTitle"),
      desc: t("pubCompliance.encryptionDesc"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ];

  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-8 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">{t("pubCompliance.title")}</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">{t("pubCompliance.subtitle")}</p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="space-y-6">
          {sections.map((s, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-6 flex gap-5"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700 flex-shrink-0 mt-0.5">
                {s.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
