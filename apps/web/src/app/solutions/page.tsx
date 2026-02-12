"use client";

import Link from "next/link";
import { ShoppingCart, Server, Briefcase, Layers, ArrowRight } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PageHeader from "@/components/ui/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import Card from "@/components/ui/Card";
import FeatureCard from "@/components/ui/FeatureCard";
import { useI18n } from "@/i18n/I18nContext";
import { designTokens } from "@/lib/designTokens";

export default function SolutionsPage() {
  const { t } = useI18n();

  const solutions = [
    { id: "ecommerce", icon: ShoppingCart, titleKey: "pubSolutions.cap.ecommerce.title", descKey: "pubSolutions.cap.ecommerce.desc" },
    { id: "saas", icon: Server, titleKey: "pubSolutions.cap.saas.title", descKey: "pubSolutions.cap.saas.desc" },
    { id: "small-business", icon: Briefcase, titleKey: "pubSolutions.cap.smallBiz.title", descKey: "pubSolutions.cap.smallBiz.desc" },
    { id: "teams", icon: Layers, titleKey: "pubSolutions.cap.teams.title", descKey: "pubSolutions.cap.teams.desc" },
  ];

  const steps = [
    { titleKey: "pubSolutions.how.step1.title", descKey: "pubSolutions.how.step1.desc" },
    { titleKey: "pubSolutions.how.step2.title", descKey: "pubSolutions.how.step2.desc" },
    { titleKey: "pubSolutions.how.step3.title", descKey: "pubSolutions.how.step3.desc" },
  ];

  const faqs = [
    { qKey: "pubSolutions.faq.q1", aKey: "pubSolutions.faq.a1" },
    { qKey: "pubSolutions.faq.q2", aKey: "pubSolutions.faq.a2" },
    { qKey: "pubSolutions.faq.q3", aKey: "pubSolutions.faq.a3" },
  ];

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <PageHeader
          title={t("pubSolutions.title")}
          subtitle={t("pubSolutions.subtitle")}
          action={
            <Link href="/contact" className={designTokens.buttons.secondary}>
              {t("nav.contactSales")}
            </Link>
          }
        />
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("pubSolutions.capabilitiesTitle")}
          subtitle={t("pubSolutions.capabilitiesSubtitle")}
        />
        <div className="grid md:grid-cols-2 gap-6">
          {solutions.map((item) => (
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
          title={t("pubSolutions.howTitle")}
          subtitle={t("pubSolutions.howSubtitle")}
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
        <SectionTitle title={t("pubSolutions.faqTitle")} subtitle={t("pubSolutions.faqSubtitle")} />
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
              {t("pubSolutions.ctaTitle")}
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              {t("pubSolutions.ctaSubtitle")}
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
