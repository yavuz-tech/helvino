"use client";

import Link from "next/link";
import { Puzzle, Users, Database, MessageSquare, Shield } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import FeatureCard from "@/components/FeatureCard";
import Card from "@/components/Card";
import { useI18n } from "@/i18n/I18nContext";
import { designTokens } from "@/lib/designTokens";

export default function IntegrationsPage() {
  const { t } = useI18n();

  const categories = [
    { icon: Users, titleKey: "pubIntegrations.cap.crm.title", descKey: "pubIntegrations.cap.crm.desc" },
    { icon: MessageSquare, titleKey: "pubIntegrations.cap.collaboration.title", descKey: "pubIntegrations.cap.collaboration.desc" },
    { icon: Database, titleKey: "pubIntegrations.cap.data.title", descKey: "pubIntegrations.cap.data.desc" },
    { icon: Shield, titleKey: "pubIntegrations.cap.security.title", descKey: "pubIntegrations.cap.security.desc" },
  ];

  const steps = [
    { titleKey: "pubIntegrations.how.step1.title", descKey: "pubIntegrations.how.step1.desc" },
    { titleKey: "pubIntegrations.how.step2.title", descKey: "pubIntegrations.how.step2.desc" },
    { titleKey: "pubIntegrations.how.step3.title", descKey: "pubIntegrations.how.step3.desc" },
  ];

  const faqs = [
    { qKey: "pubIntegrations.faq.q1", aKey: "pubIntegrations.faq.a1" },
    { qKey: "pubIntegrations.faq.q2", aKey: "pubIntegrations.faq.a2" },
    { qKey: "pubIntegrations.faq.q3", aKey: "pubIntegrations.faq.a3" },
  ];

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <PageHeader
          title={t("pubIntegrations.title")}
          subtitle={t("pubIntegrations.subtitle")}
          action={
            <Link href="/contact" className={designTokens.buttons.secondary}>
              {t("nav.contactSales")}
            </Link>
          }
        />
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("pubIntegrations.capabilitiesTitle")}
          subtitle={t("pubIntegrations.capabilitiesSubtitle")}
        />
        <div className="grid md:grid-cols-2 gap-6">
          {categories.map((item) => (
            <FeatureCard
              key={item.titleKey}
              icon={item.icon}
              title={t(item.titleKey as Parameters<typeof t>[0])}
              description={t(item.descKey as Parameters<typeof t>[0])}
            />
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle title={t("pubIntegrations.howTitle")} subtitle={t("pubIntegrations.howSubtitle")} />
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <Card key={step.titleKey} padding="lg">
              <h3 className="text-lg font-semibold text-slate-900">
                {t(step.titleKey as Parameters<typeof t>[0])}
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {t(step.descKey as Parameters<typeof t>[0])}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle title={t("pubIntegrations.faqTitle")} subtitle={t("pubIntegrations.faqSubtitle")} />
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.qKey} padding="md" variant="muted">
              <h3 className="text-sm font-semibold text-slate-900">
                {t(faq.qKey as Parameters<typeof t>[0])}
              </h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                {t(faq.aKey as Parameters<typeof t>[0])}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20">
        <Card padding="lg" variant="outlined" className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {t("pubIntegrations.ctaTitle")}
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              {t("pubIntegrations.ctaSubtitle")}
            </p>
          </div>
          <Link href="/signup" className={`${designTokens.buttons.primary} inline-flex items-center gap-2`}>
            {t("home.ctaStartFree")}
            <Puzzle className="w-4 h-4" />
          </Link>
        </Card>
      </section>
    </PublicLayout>
  );
}
