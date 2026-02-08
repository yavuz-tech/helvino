"use client";

import Link from "next/link";
import { BookOpen, UserCog, CreditCard, Wrench, MessageCircle } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import FeatureCard from "@/components/FeatureCard";
import Card from "@/components/Card";
import { useI18n } from "@/i18n/I18nContext";
import { designTokens } from "@/lib/designTokens";

export default function HelpCenterPage() {
  const { t } = useI18n();

  const topics = [
    { icon: BookOpen, titleKey: "pubHelpCenter.cap.gettingStarted.title", descKey: "pubHelpCenter.cap.gettingStarted.desc" },
    { icon: UserCog, titleKey: "pubHelpCenter.cap.account.title", descKey: "pubHelpCenter.cap.account.desc" },
    { icon: CreditCard, titleKey: "pubHelpCenter.cap.billing.title", descKey: "pubHelpCenter.cap.billing.desc" },
    { icon: Wrench, titleKey: "pubHelpCenter.cap.troubleshooting.title", descKey: "pubHelpCenter.cap.troubleshooting.desc" },
  ];

  const steps = [
    { titleKey: "pubHelpCenter.how.step1.title", descKey: "pubHelpCenter.how.step1.desc" },
    { titleKey: "pubHelpCenter.how.step2.title", descKey: "pubHelpCenter.how.step2.desc" },
    { titleKey: "pubHelpCenter.how.step3.title", descKey: "pubHelpCenter.how.step3.desc" },
  ];

  const faqs = [
    { qKey: "pubHelpCenter.faq.q1", aKey: "pubHelpCenter.faq.a1" },
    { qKey: "pubHelpCenter.faq.q2", aKey: "pubHelpCenter.faq.a2" },
    { qKey: "pubHelpCenter.faq.q3", aKey: "pubHelpCenter.faq.a3" },
  ];

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <PageHeader
          title={t("pubHelpCenter.title")}
          subtitle={t("pubHelpCenter.subtitle")}
          action={
            <Link href="/contact" className={designTokens.buttons.secondary}>
              {t("footer.contact")}
            </Link>
          }
        />
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("pubHelpCenter.capabilitiesTitle")}
          subtitle={t("pubHelpCenter.capabilitiesSubtitle")}
        />
        <div className="grid md:grid-cols-2 gap-6">
          {topics.map((item) => (
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
        <SectionTitle title={t("pubHelpCenter.howTitle")} subtitle={t("pubHelpCenter.howSubtitle")} />
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
        <SectionTitle title={t("pubHelpCenter.faqTitle")} subtitle={t("pubHelpCenter.faqSubtitle")} />
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
            {t("pubHelpCenter.ctaTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            {t("pubHelpCenter.ctaSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
            <Link href="/contact" className={designTokens.buttons.primary}>
              <MessageCircle className="w-4 h-4" />
              {t("footer.contact")}
            </Link>
            <Link href="/resources" className={designTokens.buttons.secondary}>
              {t("footer.guides")}
            </Link>
          </div>
        </Card>
      </section>
    </PublicLayout>
  );
}
