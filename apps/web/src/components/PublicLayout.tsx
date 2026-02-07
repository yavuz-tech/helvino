"use client";

import Link from "next/link";
import { APP_NAME } from "@helvino/shared";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * PublicLayout — shared header + footer for all public (non-auth) pages.
 * Used by: /, /pricing, /security, /compliance, /status, /contact
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ── Header ── */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/" className="text-xl font-bold text-slate-900 tracking-tight">
            {APP_NAME}
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">
              {t("home.footerPricing")}
            </Link>
            <Link href="/security" className="hover:text-slate-900 transition-colors">
              {t("home.footerSecurity")}
            </Link>
            <Link href="/status" className="hover:text-slate-900 transition-colors">
              {t("home.footerStatus")}
            </Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">
              {t("home.footerContact")}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/portal/login"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
            >
              {t("common.login")}
            </Link>
            <Link
              href="/signup"
              className="hidden sm:inline-flex px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              {t("home.ctaStartFree")}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {t("home.footerProduct")}
              </h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>
                  <Link href="/pricing" className="hover:text-slate-900 transition-colors">
                    {t("home.footerPricing")}
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="hover:text-slate-900 transition-colors">
                    {t("home.footerSecurity")}
                  </Link>
                </li>
                <li>
                  <Link href="/status" className="hover:text-slate-900 transition-colors">
                    {t("home.footerStatus")}
                  </Link>
                </li>
              </ul>
            </div>
            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {t("home.footerCompany")}
              </h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>
                  <Link href="/contact" className="hover:text-slate-900 transition-colors">
                    {t("home.footerContact")}
                  </Link>
                </li>
                <li>
                  <Link href="/compliance" className="hover:text-slate-900 transition-colors">
                    {t("home.footerCompliance")}
                  </Link>
                </li>
              </ul>
            </div>
            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {t("home.footerLegal")}
              </h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>
                  <Link href="/compliance" className="hover:text-slate-900 transition-colors">
                    {t("home.footerCompliance")}
                  </Link>
                </li>
              </ul>
            </div>
            {/* Get started */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {t("home.ctaStartFree")}
              </h4>
              <p className="text-sm text-slate-600 mb-3">
                {t("home.heroSubtitle").slice(0, 80)}...
              </p>
              <Link
                href="/signup"
                className="inline-flex px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
              >
                {t("home.ctaStartFree")}
              </Link>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-slate-500" suppressHydrationWarning>
              &copy; {new Date().getFullYear()} {APP_NAME}. {t("home.allRightsReserved")}
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>{t("home.trustedSecurity")}</span>
              <span>&bull;</span>
              <span>{t("home.trustedUptime")}</span>
              <span>&bull;</span>
              <span>{t("home.trustedCompliance")}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
