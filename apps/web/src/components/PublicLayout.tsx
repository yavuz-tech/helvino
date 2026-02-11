"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { APP_NAME } from "@helvino/shared";
import { useI18n } from "@/i18n/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import CampaignTopBanner from "@/components/CampaignTopBanner";
import { designTokens } from "@/lib/designTokens";
import {
  MessageCircle,
  Inbox,
  Bot,
  Zap,
  Puzzle,
  LayoutGrid,
  ShoppingCart,
  Server,
  Briefcase,
  FileText,
  RefreshCw,
  Activity,
  Newspaper,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────── */
/*  Types                                                     */
/* ─────────────────────────────────────────────────────────── */

interface DropdownItem {
  href: string;
  labelKey: string;
  descKey: string;
  icon: React.ReactNode;
}

interface NavDropdown {
  id: string;
  labelKey: string;
  items: DropdownItem[];
}

/* ─────────────────────────────────────────────────────────── */
/*  Dropdown config                                           */
/* ─────────────────────────────────────────────────────────── */

const ICON_CLS = "w-5 h-5 text-[#0F5C5C]";

const NAV_DROPDOWNS: NavDropdown[] = [
  {
    id: "product",
    labelKey: "nav.product",
    items: [
      { href: "/product#live-chat", labelKey: "nav.product.liveChat", descKey: "nav.product.liveChatDesc", icon: <MessageCircle className={ICON_CLS} /> },
      { href: "/product#help-desk", labelKey: "nav.product.helpDesk", descKey: "nav.product.helpDeskDesc", icon: <Inbox className={ICON_CLS} /> },
      { href: "/product#ai-agent", labelKey: "nav.product.aiAgent", descKey: "nav.product.aiAgentDesc", icon: <Bot className={ICON_CLS} /> },
      { href: "/product#automations", labelKey: "nav.product.automations", descKey: "nav.product.automationsDesc", icon: <Zap className={ICON_CLS} /> },
      { href: "/integrations", labelKey: "nav.product.integrations", descKey: "nav.product.integrationsDesc", icon: <Puzzle className={ICON_CLS} /> },
      { href: "/product", labelKey: "nav.product.allFeatures", descKey: "nav.product.allFeaturesDesc", icon: <LayoutGrid className={ICON_CLS} /> },
    ],
  },
  {
    id: "solutions",
    labelKey: "nav.solutions",
    items: [
      { href: "/solutions#ecommerce", labelKey: "nav.solutions.ecommerce", descKey: "nav.solutions.ecommerceDesc", icon: <ShoppingCart className={ICON_CLS} /> },
      { href: "/solutions#saas", labelKey: "nav.solutions.saas", descKey: "nav.solutions.saasDesc", icon: <Server className={ICON_CLS} /> },
      { href: "/solutions#small-business", labelKey: "nav.solutions.smallBiz", descKey: "nav.solutions.smallBizDesc", icon: <Briefcase className={ICON_CLS} /> },
    ],
  },
  {
    id: "resources",
    labelKey: "nav.resources",
    items: [
      { href: "/developers", labelKey: "nav.resources.docs", descKey: "nav.resources.docsDesc", icon: <FileText className={ICON_CLS} /> },
      { href: "/status", labelKey: "nav.resources.changelog", descKey: "nav.resources.changelogDesc", icon: <RefreshCw className={ICON_CLS} /> },
      { href: "/status", labelKey: "nav.resources.status", descKey: "nav.resources.statusDesc", icon: <Activity className={ICON_CLS} /> },
      { href: "/resources#guides", labelKey: "nav.resources.blog", descKey: "nav.resources.blogDesc", icon: <Newspaper className={ICON_CLS} /> },
    ],
  },
  {
    id: "compare",
    labelKey: "nav.compare",
    items: [
      { href: "/compare/intercom", labelKey: "nav.compare.vsIntercom", descKey: "nav.compare.desc", icon: <LayoutGrid className={ICON_CLS} /> },
      { href: "/compare/zendesk", labelKey: "nav.compare.vsZendesk", descKey: "nav.compare.desc", icon: <LayoutGrid className={ICON_CLS} /> },
      { href: "/compare/crisp", labelKey: "nav.compare.vsCrisp", descKey: "nav.compare.desc", icon: <LayoutGrid className={ICON_CLS} /> },
      { href: "/compare/tidio", labelKey: "nav.compare.vsTidio", descKey: "nav.compare.desc", icon: <LayoutGrid className={ICON_CLS} /> },
    ],
  },
];

/* ─────────────────────────────────────────────────────────── */
/*  DesktopDropdown component                                 */
/* ─────────────────────────────────────────────────────────── */

function DesktopDropdown({
  dropdown,
  isOpen,
  onToggle,
  onClose,
  t,
}: {
  dropdown: NavDropdown;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const panelId = `dropdown-${dropdown.id}`;

  /* close on click outside */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  /* close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const isWide = dropdown.id === "product"; // wider panel for product

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`inline-flex items-center gap-1 px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
          isOpen
            ? "text-slate-900 bg-slate-100"
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
        }`}
      >
        {t(dropdown.labelKey as Parameters<typeof t>[0])}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="menu"
          className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-2xl border border-slate-200/80 ${designTokens.shadows.elevated} p-2 z-50 ${
            isWide ? "w-[540px] grid grid-cols-2 gap-0.5" : "w-[320px]"
          }`}
        >
          {dropdown.items.map((item) => (
            <Link
              key={item.labelKey}
              href={item.href}
              role="menuitem"
              onClick={onClose}
              className="flex items-start gap-3 px-3.5 py-3 rounded-xl hover:bg-slate-50 transition-colors duration-150 group"
            >
              <span className="flex-shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <span className="text-sm font-medium text-slate-900 group-hover:text-[#0F5C5C] transition-colors">
                  {t(item.labelKey as Parameters<typeof t>[0])}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {t(item.descKey as Parameters<typeof t>[0])}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  MobileAccordion component                                 */
/* ─────────────────────────────────────────────────────────── */

function MobileAccordion({
  dropdown,
  isOpen,
  onToggle,
  onLinkClick,
  t,
}: {
  dropdown: NavDropdown;
  isOpen: boolean;
  onToggle: () => void;
  onLinkClick: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-slate-700"
      >
        {t(dropdown.labelKey as Parameters<typeof t>[0])}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="pb-2 px-2">
          {dropdown.items.map((item) => (
            <Link
              key={item.labelKey}
              href={item.href}
              onClick={onLinkClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm text-slate-600"
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {t(item.labelKey as Parameters<typeof t>[0])}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Footer column config                                      */
/* ─────────────────────────────────────────────────────────── */

interface FooterLink {
  href: string;
  labelKey: string;
}

interface FooterColumn {
  headingKey: string;
  links: FooterLink[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    headingKey: "footer.product",
    links: [
      { href: "/product#live-chat", labelKey: "footer.liveChat" },
      { href: "/product#help-desk", labelKey: "footer.helpDesk" },
      { href: "/product#ai-agent", labelKey: "footer.aiAgent" },
      { href: "/product#automations", labelKey: "footer.automations" },
      { href: "/integrations", labelKey: "footer.integrations" },
      { href: "/product", labelKey: "footer.allFeatures" },
    ],
  },
  {
    headingKey: "footer.company",
    links: [
      { href: "/security", labelKey: "footer.security" },
      { href: "/compliance", labelKey: "footer.privacy" },
      { href: "/compliance", labelKey: "footer.terms" },
      { href: "/contact", labelKey: "footer.contact" },
    ],
  },
  {
    headingKey: "footer.resources",
    links: [
      { href: "/developers", labelKey: "footer.docs" },
      { href: "/resources", labelKey: "footer.blog" },
      { href: "/status", labelKey: "footer.changelog" },
      { href: "/status", labelKey: "footer.status" },
      { href: "/resources#guides", labelKey: "footer.guides" },
    ],
  },
  {
    headingKey: "footer.compare",
    links: [
      { href: "/compare/intercom", labelKey: "nav.compare.vsIntercom" },
      { href: "/compare/zendesk", labelKey: "nav.compare.vsZendesk" },
      { href: "/compare/crisp", labelKey: "nav.compare.vsCrisp" },
      { href: "/compare/tidio", labelKey: "nav.compare.vsTidio" },
    ],
  },
  {
    headingKey: "footer.support",
    links: [
      { href: "/help-center", labelKey: "footer.helpCenter" },
      { href: "/developers", labelKey: "footer.developers" },
      { href: "/status", labelKey: "footer.status" },
      { href: "/contact", labelKey: "footer.contact" },
    ],
  },
];

/* ─────────────────────────────────────────────────────────── */
/*  PublicLayout                                              */
/* ─────────────────────────────────────────────────────────── */

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  /* ── Dropdown state ── */
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>(null);

  /* close dropdowns on route change */
  useEffect(() => {
    setOpenDropdown(null);
    setMobileMenuOpen(false);
    setMobileAccordion(null);
  }, [pathname]);

  const closeDesktopDropdown = useCallback(() => setOpenDropdown(null), []);

  const toggleDropdown = useCallback(
    (id: string) => setOpenDropdown((prev) => (prev === id ? null : id)),
    []
  );

  const closeMobile = useCallback(() => {
    setMobileMenuOpen(false);
    setMobileAccordion(null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ── Header ── */}
      <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          {/* Logo */}
          <Link href="/" className="text-lg font-bold text-slate-900 tracking-tight flex-shrink-0">
            {APP_NAME}
          </Link>

          {/* ── Desktop nav ── */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-8">
            {NAV_DROPDOWNS.map((dd) => (
              <DesktopDropdown
                key={dd.id}
                dropdown={dd}
                isOpen={openDropdown === dd.id}
                onToggle={() => toggleDropdown(dd.id)}
                onClose={closeDesktopDropdown}
                t={t}
              />
            ))}
            <Link
              href="/pricing"
              className="px-3.5 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-all duration-150"
            >
              {t("nav.pricing")}
            </Link>
          </nav>

          {/* ── Desktop CTAs ── */}
          <div className="hidden lg:flex items-center gap-2 ml-auto">
            <LanguageSwitcher />
            <CurrencySwitcher />
            <Link
              href="/contact"
              className="px-3.5 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium rounded-lg hover:bg-slate-50"
            >
              {t("nav.contactSales")}
            </Link>
            <Link
              href="/portal/login?reauth=1"
              className="px-3.5 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium rounded-lg hover:bg-slate-50"
            >
              {t("common.login")}
            </Link>
            <Link
              href="/signup"
              className={designTokens.buttons.primary}
            >
              {t("home.ctaStartFree")}
            </Link>
          </div>

          {/* ── Mobile burger ── */}
          <div className="flex lg:hidden items-center gap-2">
            <LanguageSwitcher />
            <CurrencySwitcher />
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={t("nav.menu")}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-700" />
              ) : (
                <Menu className="w-5 h-5 text-slate-700" />
              )}
            </button>
          </div>
        </div>

        {/* ── Mobile menu ── */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200/60 bg-white max-h-[80vh] overflow-y-auto">
            {NAV_DROPDOWNS.map((dd) => (
              <MobileAccordion
                key={dd.id}
                dropdown={dd}
                isOpen={mobileAccordion === dd.id}
                onToggle={() =>
                  setMobileAccordion((prev) => (prev === dd.id ? null : dd.id))
                }
                onLinkClick={closeMobile}
                t={t}
              />
            ))}
            <Link
              href="/pricing"
              onClick={closeMobile}
              className="block px-4 py-3.5 text-sm font-medium text-slate-700 border-b border-slate-100"
            >
              {t("nav.pricing")}
            </Link>

            {/* Mobile CTAs */}
            <div className="p-4 space-y-2 border-t border-slate-100">
              <Link
                href="/signup"
                onClick={closeMobile}
                className={designTokens.buttons.primary + " w-full text-center"}
              >
                {t("home.ctaStartFree")}
              </Link>
              <Link
                href="/contact"
                onClick={closeMobile}
                className={designTokens.buttons.secondary + " w-full text-center"}
              >
                {t("nav.contactSales")}
              </Link>
              <Link
                href="/portal/login?reauth=1"
                onClick={closeMobile}
                className={designTokens.buttons.ghost + " w-full text-center"}
              >
                {t("common.login")}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Campaign banner (global campaigns visible on public website) ── */}
      <CampaignTopBanner source="public" />

      {/* ── Main ── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200/60 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6 py-14">
          {/* Top row: brand + columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 mb-4 lg:mb-0">
              <Link href="/" className="text-lg font-bold text-slate-900 tracking-tight">
                {APP_NAME}
              </Link>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-[200px]">
                {t("footer.tagline")}
              </p>
              <div className="flex gap-2 mt-5">
                <Link
                  href="/signup"
                  className="inline-flex items-center px-4 py-2 bg-[#0F5C5C] text-white text-xs font-semibold rounded-lg hover:bg-[#0D4F4F] transition-all duration-150 shadow-[0_1px_3px_rgba(15,92,92,0.2)]"
                >
                  {t("home.ctaStartFree")}
                </Link>
              </div>
            </div>

            {/* Directory columns */}
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.headingKey}>
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">
                  {t(col.headingKey as Parameters<typeof t>[0])}
                </h4>
                <ul className="space-y-2.5 text-sm">
                  {col.links.map((link) => (
                    <li key={link.labelKey + link.href}>
                      <Link
                        href={link.href}
                        className="text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        {t(link.labelKey as Parameters<typeof t>[0])}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom legal row */}
          <div className="border-t border-slate-200/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400" suppressHydrationWarning>
              &copy; {new Date().getFullYear()} {APP_NAME}. {t("home.allRightsReserved")}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <Link href="/compliance" className="hover:text-slate-600 transition-colors">
                {t("footer.privacy")}
              </Link>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <Link href="/compliance" className="hover:text-slate-600 transition-colors">
                {t("footer.terms")}
              </Link>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <Link href="/security" className="hover:text-slate-600 transition-colors">
                {t("footer.security")}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
