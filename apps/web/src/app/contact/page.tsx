"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import Card from "@/components/Card";
import { designTokens } from "@/lib/designTokens";

export default function ContactPage() {
  const { t } = useI18n();

  const channels = [
    {
      title: t("pubContact.salesTitle"),
      desc: t("pubContact.salesDesc"),
      email: "sales@helvion.io",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: t("pubContact.supportTitle"),
      desc: t("pubContact.supportDesc"),
      email: "support@helvion.io",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      title: t("pubContact.partnerTitle"),
      desc: t("pubContact.partnerDesc"),
      email: "partners@helvion.io",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  const steps = [
    { titleKey: "pubContact.how.step1.title", descKey: "pubContact.how.step1.desc" },
    { titleKey: "pubContact.how.step2.title", descKey: "pubContact.how.step2.desc" },
    { titleKey: "pubContact.how.step3.title", descKey: "pubContact.how.step3.desc" },
  ];

  const faqs = [
    { qKey: "pubContact.faq.q1", aKey: "pubContact.faq.a1" },
    { qKey: "pubContact.faq.q2", aKey: "pubContact.faq.a2" },
    { qKey: "pubContact.faq.q3", aKey: "pubContact.faq.a3" },
  ];

  return (
    <PublicLayout>
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-8">
        <PageHeader
          title={t("pubContact.title")}
          subtitle={t("pubContact.subtitle")}
          action={
            <Link href="/signup" className={designTokens.buttons.primary}>
              {t("home.ctaStartFree")}
            </Link>
          }
        />
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("pubContact.channelsTitle")}
          subtitle={t("pubContact.channelsSubtitle")}
        />
        <div className="grid sm:grid-cols-3 gap-6">
          {channels.map((ch, i) => (
            <Card key={i} padding="lg" className="text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700 mx-auto mb-4">
                {ch.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{ch.title}</h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">{ch.desc}</p>
              <p className="text-sm font-medium text-slate-800">
                {t("pubContact.emailLabel")}:{" "}
                <span className="text-blue-600">{ch.email}</span>
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <SectionTitle title={t("pubContact.howTitle")} subtitle={t("pubContact.howSubtitle")} />
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
        <SectionTitle title={t("pubContact.faqTitle")} subtitle={t("pubContact.faqSubtitle")} />
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

      <section className="max-w-4xl mx-auto px-6 pb-14">
        <Card padding="lg" variant="outlined">
          <h2 className="text-xl font-semibold text-slate-900 mb-6 text-center">
            {t("pubContact.formSend")}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pubContact.formName")}
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pubContact.formEmail")}
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pubContact.formSubject")}
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pubContact.formMessage")}
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              {t("pubContact.formSend")}
            </button>
            <p className="text-xs text-slate-400 text-center">{t("pubContact.formNote")}</p>
          </form>
        </Card>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20">
        <Card padding="lg" variant="outlined" className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            {t("pubContact.ctaTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            {t("pubContact.ctaSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
            <Link href="/pricing" className={designTokens.buttons.secondary}>
              {t("nav.pricing")}
            </Link>
            <Link href="/signup" className={designTokens.buttons.primary}>
              {t("home.ctaStartFree")}
            </Link>
          </div>
        </Card>
      </section>
    </PublicLayout>
  );
}
