"use client";

import Link from "next/link";
import { MessageCircle, Inbox, Bot, Zap, Puzzle, BarChart3 } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import FeatureCard from "@/components/FeatureCard";
import Card from "@/components/Card";
import { useI18n } from "@/i18n/I18nContext";
import { designTokens } from "@/lib/designTokens";

export default function ProductPage() {
  const { t } = useI18n();

  const capabilities = [
    { id: "live-chat", icon: MessageCircle, titleKey: "pubProduct.cap.liveChat.title", descKey: "pubProduct.cap.liveChat.desc" },
    { id: "help-desk", icon: Inbox, titleKey: "pubProduct.cap.helpDesk.title", descKey: "pubProduct.cap.helpDesk.desc" },
    { id: "ai-agent", icon: Bot, titleKey: "pubProduct.cap.aiAgent.title", descKey: "pubProduct.cap.aiAgent.desc" },
    { id: "automations", icon: Zap, titleKey: "pubProduct.cap.automations.title", descKey: "pubProduct.cap.automations.desc" },
    { id: "integrations", icon: Puzzle, titleKey: "pubProduct.cap.integrations.title", descKey: "pubProduct.cap.integrations.desc" },
    { id: "insights", icon: BarChart3, titleKey: "pubProduct.cap.insights.title", descKey: "pubProduct.cap.insights.desc" },
  ];

  const steps = [
    { titleKey: "pubProduct.how.step1.title", descKey: "pubProduct.how.step1.desc" },
    { titleKey: "pubProduct.how.step2.title", descKey: "pubProduct.how.step2.desc" },
    { titleKey: "pubProduct.how.step3.title", descKey: "pubProduct.how.step3.desc" },
  ];

  const faqs = [
    { qKey: "pubProduct.faq.q1", aKey: "pubProduct.faq.a1" },
    { qKey: "pubProduct.faq.q2", aKey: "pubProduct.faq.a2" },
    { qKey: "pubProduct.faq.q3", aKey: "pubProduct.faq.a3" },
    { qKey: "pubProduct.faq.q4", aKey: "pubProduct.faq.a4" },
  ];

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <PageHeader
          title={t("pubProduct.title")}
          subtitle={t("pubProduct.subtitle")}
          action={
            <div className="flex items-center gap-2">
              <Link href="/signup" className={designTokens.buttons.primary}>
                {t("home.ctaStartFree")}
              </Link>
              <Link href="/pricing" className={designTokens.buttons.secondary}>
                {t("nav.pricing")}
              </Link>
            </div>
          }
        />
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-12" id="features">
        <SectionTitle
          title={t("pubProduct.capabilitiesTitle")}
          subtitle={t("pubProduct.capabilitiesSubtitle")}
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap) => (
            <div key={cap.id} id={cap.id} className="scroll-mt-24">
              <FeatureCard
                icon={cap.icon}
                title={t(cap.titleKey as Parameters<typeof t>[0])}
                description={t(cap.descKey as Parameters<typeof t>[0])}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("pubProduct.howTitle")}
          subtitle={t("pubProduct.howSubtitle")}
        />
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, idx) => (
            <Card key={step.titleKey} padding="lg">
              <p className="text-xs font-semibold text-slate-400 tracking-widest uppercase">
                {t("pubProduct.stepLabel").replace("{step}", String(idx + 1))}
              </p>
              <h3 className="text-lg font-semibold text-slate-900 mt-2">
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
        <SectionTitle title={t("pubProduct.faqTitle")} subtitle={t("pubProduct.faqSubtitle")} />
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
        <Card padding="lg" variant="outlined" className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            {t("pubProduct.ctaTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            {t("pubProduct.ctaSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
            <Link href="/signup" className={designTokens.buttons.primary}>
              {t("home.ctaStartFree")}
            </Link>
            <Link href="/contact" className={designTokens.buttons.secondary}>
              {t("nav.contactSales")}
            </Link>
          </div>
        </Card>
      </section>
    </PublicLayout>
  );
}
