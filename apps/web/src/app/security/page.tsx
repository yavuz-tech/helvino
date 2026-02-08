"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import Card from "@/components/Card";
import { designTokens } from "@/lib/designTokens";

const ShieldIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const LockIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const ClipboardIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const BanIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);
const CodeIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);
const RefreshIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export default function SecurityPage() {
  const { t } = useI18n();

  const sections = [
    { icon: <ShieldIcon />, title: t("pubSecurity.authTitle"), desc: t("pubSecurity.authDesc") },
    { icon: <LockIcon />, title: t("pubSecurity.dataTitle"), desc: t("pubSecurity.dataDesc") },
    { icon: <ClipboardIcon />, title: t("pubSecurity.auditTitle"), desc: t("pubSecurity.auditDesc") },
    { icon: <BanIcon />, title: t("pubSecurity.abuseTitle"), desc: t("pubSecurity.abuseDesc") },
    { icon: <CodeIcon />, title: t("pubSecurity.widgetTitle"), desc: t("pubSecurity.widgetDesc") },
    { icon: <RefreshIcon />, title: t("pubSecurity.recoveryTitle"), desc: t("pubSecurity.recoveryDesc") },
  ];

  const steps = [
    { titleKey: "pubSecurity.how.step1.title", descKey: "pubSecurity.how.step1.desc" },
    { titleKey: "pubSecurity.how.step2.title", descKey: "pubSecurity.how.step2.desc" },
    { titleKey: "pubSecurity.how.step3.title", descKey: "pubSecurity.how.step3.desc" },
  ];

  const faqs = [
    { qKey: "pubSecurity.faq.q1", aKey: "pubSecurity.faq.a1" },
    { qKey: "pubSecurity.faq.q2", aKey: "pubSecurity.faq.a2" },
    { qKey: "pubSecurity.faq.q3", aKey: "pubSecurity.faq.a3" },
  ];

  return (
    <PublicLayout>
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-8">
        <PageHeader
          title={t("pubSecurity.title")}
          subtitle={t("pubSecurity.subtitle")}
          action={
            <Link href="/contact" className={designTokens.buttons.secondary}>
              {t("footer.contact")}
            </Link>
          }
        />
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle title={t("pubSecurity.capabilitiesTitle")} subtitle={t("pubSecurity.capabilitiesSubtitle")} />
        <div className="grid sm:grid-cols-2 gap-6">
          {sections.map((s, i) => (
            <Card key={i} padding="lg">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700 mb-4">
                {s.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle title={t("pubSecurity.howTitle")} subtitle={t("pubSecurity.howSubtitle")} />
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
        <SectionTitle title={t("pubSecurity.faqTitle")} subtitle={t("pubSecurity.faqSubtitle")} />
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
            {t("pubSecurity.ctaTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            {t("pubSecurity.ctaSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
            <Link href="/contact" className={designTokens.buttons.primary}>
              {t("footer.contact")}
            </Link>
            <Link href="/compliance" className={designTokens.buttons.secondary}>
              {t("pubSecurity.ctaSecondary")}
            </Link>
          </div>
        </Card>
      </section>
    </PublicLayout>
  );
}
