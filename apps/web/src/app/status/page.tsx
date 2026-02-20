"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import { useHydrated } from "@/hooks/useHydrated";
import PublicLayout from "@/components/PublicLayout";
import PageHeader from "@/components/ui/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import Card from "@/components/ui/Card";
import { designTokens } from "@/lib/designTokens";

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
        return "bg-[#94A3B8]";
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

  const steps = [
    { titleKey: "pubStatus.how.step1.title", descKey: "pubStatus.how.step1.desc" },
    { titleKey: "pubStatus.how.step2.title", descKey: "pubStatus.how.step2.desc" },
    { titleKey: "pubStatus.how.step3.title", descKey: "pubStatus.how.step3.desc" },
  ];

  const faqs = [
    { qKey: "pubStatus.faq.q1", aKey: "pubStatus.faq.a1" },
    { qKey: "pubStatus.faq.q2", aKey: "pubStatus.faq.a2" },
    { qKey: "pubStatus.faq.q3", aKey: "pubStatus.faq.a3" },
  ];

  return (
    <PublicLayout>
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-8">
        <PageHeader
          title={t("pubStatus.title")}
          subtitle={t("pubStatus.subtitle")}
          action={
            <Link href="/contact" className={designTokens.buttons.secondary}>
              {t("footer.contact")}
            </Link>
          }
        />
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
        <div className="bg-white rounded-xl border border-slate-200/80 divide-y divide-slate-200/60">
          {SERVICES.map((svc, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-medium text-[#1E293B]">
                {t(svc.nameKey as Parameters<typeof t>[0])}
              </span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusColor(svc.status)}`} />
                <span className="text-sm text-[#475569]">{statusLabel(svc.status)}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#94A3B8] mt-3 text-center" suppressHydrationWarning>
          {t("pubStatus.lastChecked")}: {hydrated ? new Date().toLocaleString() : "…"}
        </p>
      </section>

      {/* Incident history */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-lg font-semibold text-[#1A1D23] font-heading mb-4">{t("pubStatus.incidentHistory")}</h2>
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center">
          <p className="text-sm text-[#64748B]">{t("pubStatus.noIncidents")}</p>
        </div>
        <p className="text-xs text-[#94A3B8] mt-3 text-center">{t("pubStatus.uptimeNote")}</p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle title={t("pubStatus.howTitle")} subtitle={t("pubStatus.howSubtitle")} />
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <Card key={step.titleKey} padding="lg">
              <h3 className="text-lg font-semibold text-[#1A1D23] font-heading">
                {t(step.titleKey as Parameters<typeof t>[0])}
              </h3>
              <p className="text-sm text-[#475569] mt-2 leading-relaxed">
                {t(step.descKey as Parameters<typeof t>[0])}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle title={t("pubStatus.faqTitle")} subtitle={t("pubStatus.faqSubtitle")} />
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.qKey} padding="md" variant="muted">
              <h3 className="text-sm font-semibold text-[#1A1D23] font-heading">
                {t(faq.qKey as Parameters<typeof t>[0])}
              </h3>
              <p className="text-sm text-[#475569] mt-1 leading-relaxed">
                {t(faq.aKey as Parameters<typeof t>[0])}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20">
        <Card padding="lg" variant="outlined" className="text-center">
          <h2 className="text-2xl font-semibold text-[#1A1D23] font-heading">
            {t("pubStatus.ctaTitle")}
          </h2>
          <p className="text-sm text-[#475569] mt-2">
            {t("pubStatus.ctaSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
            <Link href="/contact" className={designTokens.buttons.primary}>
              {t("footer.contact")}
            </Link>
            <Link href="/security" className={designTokens.buttons.secondary}>
              {t("footer.security")}
            </Link>
          </div>
        </Card>
      </section>
    </PublicLayout>
  );
}
