"use client";

import Link from "next/link";
import { Code, Plug, Bell, ShieldCheck, ArrowRight } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PageHeader from "@/components/ui/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import FeatureCard from "@/components/ui/FeatureCard";
import Card from "@/components/ui/Card";
import { useI18n } from "@/i18n/I18nContext";
import { designTokens } from "@/lib/designTokens";

export default function DevelopersPage() {
  const { t } = useI18n();

  const capabilities = [
    { icon: Code, titleKey: "pubDevelopers.cap.api.title", descKey: "pubDevelopers.cap.api.desc" },
    { icon: Plug, titleKey: "pubDevelopers.cap.webhooks.title", descKey: "pubDevelopers.cap.webhooks.desc" },
    { icon: Bell, titleKey: "pubDevelopers.cap.events.title", descKey: "pubDevelopers.cap.events.desc" },
    { icon: ShieldCheck, titleKey: "pubDevelopers.cap.auth.title", descKey: "pubDevelopers.cap.auth.desc" },
  ];

  const steps = [
    { titleKey: "pubDevelopers.how.step1.title", descKey: "pubDevelopers.how.step1.desc" },
    { titleKey: "pubDevelopers.how.step2.title", descKey: "pubDevelopers.how.step2.desc" },
    { titleKey: "pubDevelopers.how.step3.title", descKey: "pubDevelopers.how.step3.desc" },
  ];

  const faqs = [
    { qKey: "pubDevelopers.faq.q1", aKey: "pubDevelopers.faq.a1" },
    { qKey: "pubDevelopers.faq.q2", aKey: "pubDevelopers.faq.a2" },
    { qKey: "pubDevelopers.faq.q3", aKey: "pubDevelopers.faq.a3" },
  ];

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <PageHeader
          title={t("pubDevelopers.title")}
          subtitle={t("pubDevelopers.subtitle")}
          action={
            <Link href="/contact" className={designTokens.buttons.secondary}>
              {t("nav.contactSales")}
            </Link>
          }
        />
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("pubDevelopers.capabilitiesTitle")}
          subtitle={t("pubDevelopers.capabilitiesSubtitle")}
        />
        <div className="grid md:grid-cols-2 gap-6">
          {capabilities.map((item) => (
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
        <SectionTitle title={t("pubDevelopers.howTitle")} subtitle={t("pubDevelopers.howSubtitle")} />
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
        <SectionTitle title={t("pubDevelopers.faqTitle")} subtitle={t("pubDevelopers.faqSubtitle")} />
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
              {t("pubDevelopers.ctaTitle")}
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              {t("pubDevelopers.ctaSubtitle")}
            </p>
          </div>
          <Link href="/signup" className={`${designTokens.buttons.primary} inline-flex items-center gap-2`}>
            {t("home.ctaStartFree")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>
      </section>
    </PublicLayout>
  );
}
