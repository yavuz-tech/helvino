"use client";

import Link from "next/link";
import { BookOpen, Newspaper, FileText, Sparkles, LifeBuoy } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PageHeader from "@/components/ui/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import FeatureCard from "@/components/ui/FeatureCard";
import Card from "@/components/ui/Card";
import { useI18n } from "@/i18n/I18nContext";
import { designTokens } from "@/lib/designTokens";

export default function ResourcesPage() {
  const { t } = useI18n();

  const resources = [
    { id: "guides", icon: BookOpen, titleKey: "pubResources.cap.guides.title", descKey: "pubResources.cap.guides.desc" },
    { id: "updates", icon: Newspaper, titleKey: "pubResources.cap.updates.title", descKey: "pubResources.cap.updates.desc" },
    { id: "templates", icon: FileText, titleKey: "pubResources.cap.templates.title", descKey: "pubResources.cap.templates.desc" },
    { id: "best-practices", icon: Sparkles, titleKey: "pubResources.cap.bestPractices.title", descKey: "pubResources.cap.bestPractices.desc" },
  ];

  const steps = [
    { titleKey: "pubResources.how.step1.title", descKey: "pubResources.how.step1.desc" },
    { titleKey: "pubResources.how.step2.title", descKey: "pubResources.how.step2.desc" },
    { titleKey: "pubResources.how.step3.title", descKey: "pubResources.how.step3.desc" },
  ];

  const faqs = [
    { qKey: "pubResources.faq.q1", aKey: "pubResources.faq.a1" },
    { qKey: "pubResources.faq.q2", aKey: "pubResources.faq.a2" },
    { qKey: "pubResources.faq.q3", aKey: "pubResources.faq.a3" },
  ];

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <PageHeader
          title={t("pubResources.title")}
          subtitle={t("pubResources.subtitle")}
          action={
            <Link href="/help-center" className={designTokens.buttons.secondary}>
              {t("footer.helpCenter")}
            </Link>
          }
        />
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("pubResources.capabilitiesTitle")}
          subtitle={t("pubResources.capabilitiesSubtitle")}
        />
        <div className="grid md:grid-cols-2 gap-6">
          {resources.map((item) => (
            <div key={item.id} id={item.id} className="scroll-mt-24">
              <FeatureCard
                icon={item.icon}
                title={t(item.titleKey as Parameters<typeof t>[0])}
                description={t(item.descKey as Parameters<typeof t>[0])}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("pubResources.howTitle")}
          subtitle={t("pubResources.howSubtitle")}
        />
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
        <SectionTitle title={t("pubResources.faqTitle")} subtitle={t("pubResources.faqSubtitle")} />
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
              {t("pubResources.ctaTitle")}
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              {t("pubResources.ctaSubtitle")}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/developers" className={designTokens.buttons.secondary}>
              {t("footer.developers")}
            </Link>
            <Link href="/contact" className={`${designTokens.buttons.primary} inline-flex items-center gap-2`}>
              <LifeBuoy className="w-4 h-4" />
              {t("nav.contactSales")}
            </Link>
          </div>
        </Card>
      </section>
    </PublicLayout>
  );
}
