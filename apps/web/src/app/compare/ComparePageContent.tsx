"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import { designTokens } from "@/lib/designTokens";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import SectionTitle from "@/components/SectionTitle";

type CompetitorKey = "tidio" | "intercom" | "zendesk" | "crisp";

interface ComparePageContentProps {
  competitorKey: CompetitorKey;
}

const COMPETITOR_CONTENT: Record<CompetitorKey, {
  nameKey: string;
  summaryKey: string;
  fitItems: string[];
}> = {
  intercom: {
    nameKey: "compare.intercom.name",
    summaryKey: "compare.intercom.summary",
    fitItems: [
      "compare.intercom.fitItems.1",
      "compare.intercom.fitItems.2",
      "compare.intercom.fitItems.3",
    ],
  },
  zendesk: {
    nameKey: "compare.zendesk.name",
    summaryKey: "compare.zendesk.summary",
    fitItems: [
      "compare.zendesk.fitItems.1",
      "compare.zendesk.fitItems.2",
      "compare.zendesk.fitItems.3",
    ],
  },
  crisp: {
    nameKey: "compare.crisp.name",
    summaryKey: "compare.crisp.summary",
    fitItems: [
      "compare.crisp.fitItems.1",
      "compare.crisp.fitItems.2",
      "compare.crisp.fitItems.3",
    ],
  },
  tidio: {
    nameKey: "compare.tidio.name",
    summaryKey: "compare.tidio.summary",
    fitItems: [
      "compare.tidio.fitItems.1",
      "compare.tidio.fitItems.2",
      "compare.tidio.fitItems.3",
    ],
  },
};

const KEY_DIFFS = [
  { titleKey: "compare.common.keyDiffs.1Title", descKey: "compare.common.keyDiffs.1Desc" },
  { titleKey: "compare.common.keyDiffs.2Title", descKey: "compare.common.keyDiffs.2Desc" },
  { titleKey: "compare.common.keyDiffs.3Title", descKey: "compare.common.keyDiffs.3Desc" },
];

const FEATURE_ROWS = [
  { nameKey: "compare.common.features.liveChat", helvinoStatusKey: "compare.common.status.included", competitorStatusKey: "compare.common.status.varies" },
  { nameKey: "compare.common.features.aiAssist", helvinoStatusKey: "compare.common.status.supported", competitorStatusKey: "compare.common.status.check" },
  { nameKey: "compare.common.features.automation", helvinoStatusKey: "compare.common.status.included", competitorStatusKey: "compare.common.status.typical" },
  { nameKey: "compare.common.features.routing", helvinoStatusKey: "compare.common.status.included", competitorStatusKey: "compare.common.status.varies" },
  { nameKey: "compare.common.features.analytics", helvinoStatusKey: "compare.common.status.available", competitorStatusKey: "compare.common.status.check" },
  { nameKey: "compare.common.features.integrations", helvinoStatusKey: "compare.common.status.available", competitorStatusKey: "compare.common.status.typical" },
  { nameKey: "compare.common.features.security", helvinoStatusKey: "compare.common.status.supported", competitorStatusKey: "compare.common.status.check" },
  { nameKey: "compare.common.features.multiLang", helvinoStatusKey: "compare.common.status.available", competitorStatusKey: "compare.common.status.varies" },
];

const MIGRATION_STEPS = [
  { titleKey: "compare.common.migrationSteps.1Title", descKey: "compare.common.migrationSteps.1Desc" },
  { titleKey: "compare.common.migrationSteps.2Title", descKey: "compare.common.migrationSteps.2Desc" },
  { titleKey: "compare.common.migrationSteps.3Title", descKey: "compare.common.migrationSteps.3Desc" },
  { titleKey: "compare.common.migrationSteps.4Title", descKey: "compare.common.migrationSteps.4Desc" },
];

const SECURITY_ITEMS = [
  "compare.common.securityItems.1",
  "compare.common.securityItems.2",
  "compare.common.securityItems.3",
  "compare.common.securityItems.4",
  "compare.common.securityItems.5",
];

const FAQ_ITEMS = [
  { qKey: "compare.common.faq1.q", aKey: "compare.common.faq1.a" },
  { qKey: "compare.common.faq2.q", aKey: "compare.common.faq2.a" },
  { qKey: "compare.common.faq3.q", aKey: "compare.common.faq3.a" },
  { qKey: "compare.common.faq4.q", aKey: "compare.common.faq4.a" },
];

export default function ComparePageContent({ competitorKey }: ComparePageContentProps) {
  const { t } = useI18n();
  const competitor = COMPETITOR_CONTENT[competitorKey];
  const competitorName = t(competitor.nameKey as Parameters<typeof t>[0]);
  const withCompetitor = (key: string) =>
    t(key as Parameters<typeof t>[0]).replace("{competitor}", competitorName);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <Card variant="muted" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E6F4F4] via-white to-slate-50" />
          <div className="relative p-8 sm:p-10">
            <Badge variant="premium" size="md" className="mb-4">
              {competitorName}
            </Badge>
            <h1 className={designTokens.typography.pageTitle + " mb-3"}>
              {withCompetitor("compare.common.heroTitle")}
            </h1>
            <p className={designTokens.typography.body + " max-w-2xl mb-2"}>
              {t("compare.common.heroSubtitle")}
            </p>
            <p className="text-xs text-slate-400 mb-6">
              {t("compare.common.heroNote")}
            </p>
            <div className="flex flex-wrap gap-3" aria-label="Compare page primary actions">
              <Link href="/signup" className={designTokens.buttons.primary}>
                {t("compare.common.primaryCta")}
              </Link>
              <Link href="/contact" className={designTokens.buttons.secondary}>
                {t("compare.common.secondaryCta")}
              </Link>
              <Link href="/pricing" className={designTokens.buttons.ghost}>
                {t("compare.common.tertiaryCta")}
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* Who it's for */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("compare.common.whoForTitle")}
          subtitle={t("compare.common.whoForSubtitle")}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <Badge variant="info" className="mb-3">
              {t("compare.common.helvinoFitTitle")}
            </Badge>
            <ul className="space-y-2 text-sm text-slate-600">
              {[
                "compare.common.helvinoFitItems.1",
                "compare.common.helvinoFitItems.2",
                "compare.common.helvinoFitItems.3",
              ].map((key) => (
                <li key={key} className="flex gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#0F5C5C]" />
                  <span>{t(key as Parameters<typeof t>[0])}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <Badge variant="default" className="mb-3">
              {withCompetitor("compare.common.competitorFitTitle")}
            </Badge>
            <p className="text-sm text-slate-500 mb-3">
              {t(competitor.summaryKey as Parameters<typeof t>[0])}
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              {competitor.fitItems.map((key) => (
                <li key={key} className="flex gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <span>{t(key as Parameters<typeof t>[0])}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* Key differences */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("compare.common.keyDiffsTitle")}
          subtitle={t("compare.common.keyDiffsSubtitle")}
        />
        <div className="grid gap-6 md:grid-cols-3">
          {KEY_DIFFS.map((item) => (
            <Card key={item.titleKey} hover>
              <h3 className="text-base font-semibold text-slate-900 mb-2">
                {t(item.titleKey as Parameters<typeof t>[0])}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t(item.descKey as Parameters<typeof t>[0])}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Feature matrix */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("compare.common.matrixTitle")}
          subtitle={t("compare.common.matrixSubtitle")}
        />
        <Card padding="none">
          <div className="grid grid-cols-3 border-b border-slate-200/80">
            <div className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {t("compare.title")}
            </div>
            <div className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {t("compare.common.matrixColumns.helvino")}
            </div>
            <div className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {withCompetitor("compare.common.matrixColumns.competitor")}
            </div>
          </div>
          {FEATURE_ROWS.map((row, index) => (
            <div
              key={row.nameKey}
              className={`grid grid-cols-3 ${index < FEATURE_ROWS.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <div className="px-5 py-3 text-sm text-slate-700">
                {t(row.nameKey as Parameters<typeof t>[0])}
              </div>
              <div className="px-5 py-3 text-sm font-medium text-slate-800">
                {t(row.helvinoStatusKey as Parameters<typeof t>[0])}
              </div>
              <div className="px-5 py-3 text-sm text-slate-600">
                {t(row.competitorStatusKey as Parameters<typeof t>[0])}
              </div>
            </div>
          ))}
        </Card>
        <p className="text-xs text-slate-400 mt-3">
          {t("compare.common.matrixFootnote")}
        </p>
      </section>

      {/* Migration guide */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("compare.common.migrationTitle")}
          subtitle={t("compare.common.migrationSubtitle")}
        />
        <div className="grid gap-6 md:grid-cols-2">
          {MIGRATION_STEPS.map((step, idx) => (
            <Card key={step.titleKey}>
              <div className="text-xs text-slate-400 font-semibold mb-2">
                {idx + 1}. {t(step.titleKey as Parameters<typeof t>[0])}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t(step.descKey as Parameters<typeof t>[0])}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Security checklist */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle
          title={t("compare.common.securityTitle")}
          subtitle={t("compare.common.securitySubtitle")}
        />
        <Card>
          <ul className="space-y-3 text-sm text-slate-600">
            {SECURITY_ITEMS.map((key) => (
              <li key={key} className="flex gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>{t(key as Parameters<typeof t>[0])}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* FAQs */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <SectionTitle title={t("compare.common.faqTitle")} />
        <div className="grid gap-4">
          {FAQ_ITEMS.map((item) => (
            <Card key={item.qKey} variant="muted">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                {withCompetitor(item.qKey)}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {withCompetitor(item.aKey)}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <Card className="text-center">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {t("compare.common.finalTitle")}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {t("compare.common.finalSubtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-3" aria-label="Compare page final actions">
            <Link href="/signup" className={designTokens.buttons.primary}>
              {t("compare.common.finalPrimary")}
            </Link>
            <Link href="/contact" className={designTokens.buttons.secondary}>
              {t("compare.common.finalSecondary")}
            </Link>
          </div>
        </Card>
      </section>
    </PublicLayout>
  );
}
