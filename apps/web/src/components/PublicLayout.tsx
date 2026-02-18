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
import { colors, fonts } from "@/lib/design-tokens";
import HelvionLogo from "@/components/brand/HelvionLogo";
import {
  mountPublicWidgetScript,
  resolvePublicWidgetIdentity,
} from "@/lib/public-widget";
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

const ICON_CLS = "w-5 h-5 text-amber-600";

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
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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
          className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-2xl border border-slate-200/80 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.15)] p-2 z-50 ${
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
                <span className="text-sm font-medium text-slate-900 group-hover:text-amber-600 transition-colors">
                  {t(item.labelKey as Parameters<typeof t>[0])}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
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
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-slate-800"
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
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
  void colors;
  void fonts;
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

  /* Mount the Helvion chat widget on public pages */
  useEffect(() => {
    const identity = resolvePublicWidgetIdentity();
    // Widget-v2 loader requires siteId; avoid mounting script without it.
    if (identity.siteId) {
      mountPublicWidgetScript(identity);
    }
  }, []);

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
      {/* ── Announcement bar ── */}
      <div className="bg-gradient-to-r from-amber-50 via-amber-50/90 to-amber-100/80 border-b border-amber-200/60 text-center py-2 px-4">
        <p className="text-sm text-amber-900/90 font-medium">
          ✨ {t("nav.announcement")}
        </p>
      </div>

      {/* ── Header ── */}
      <header className="border-b border-[#F3E8D8] bg-white/95 backdrop-blur-xl sticky top-0 z-40 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-[72px]">
          {/* Logo (SVG, no quality loss) */}
          <Link
            href="/"
            className="flex items-center flex-shrink-0 group"
            aria-label={APP_NAME}
          >
            <HelvionLogo
              variant="light"
              alt={APP_NAME}
              heightClassName="h-7"
              className="transition-opacity duration-200 group-hover:opacity-90"
            />
          </Link>

          {/* ── Desktop nav ── */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-10">
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
              className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-all duration-150"
            >
              {t("nav.pricing")}
            </Link>
          </nav>

          {/* ── Desktop CTAs ── */}
          <div className="hidden lg:flex items-center gap-1 ml-auto">
            <LanguageSwitcher />
            <CurrencySwitcher />
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <Link
              href="/contact"
              className="px-3.5 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium rounded-lg"
            >
              {t("nav.contactSales")}
            </Link>
            <Link
              href="/portal/login?reauth=1"
              className="px-3.5 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium rounded-lg"
            >
              {t("common.login")}
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-[0_2px_8px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_14px_rgba(245,158,11,0.4)] transition-all duration-200 hover:-translate-y-0.5"
            >
              {t("home.ctaStartFree")}
              <span className="text-white/90">→</span>
            </Link>
          </div>

          {/* ── Mobile burger ── */}
          <div className="flex lg:hidden items-center gap-2">
            <LanguageSwitcher />
            <CurrencySwitcher />
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={t("nav.menu")}
              className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
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
          <div className="lg:hidden border-t border-slate-200 bg-white max-h-[80vh] overflow-y-auto">
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
              className="block px-4 py-3.5 text-sm font-medium text-slate-800 border-b border-slate-100"
            >
              {t("nav.pricing")}
            </Link>

            {/* Mobile CTAs */}
            <div className="p-4 space-y-2 border-t border-slate-100">
              <Link
                href="/signup"
                onClick={closeMobile}
                className="inline-flex items-center justify-center gap-1.5 w-full py-3 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-[0_2px_8px_rgba(245,158,11,0.35)] transition-all duration-200"
              >
                {t("home.ctaStartFree")}
                <span className="text-white/90">→</span>
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
      <footer className="bg-[#0D0D12] text-slate-300">
        <div className="max-w-7xl mx-auto px-6 py-16">
          {/* Top row: brand + columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-10 mb-14">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
              <Link href="/" className="inline-flex items-center group" aria-label={APP_NAME}>
                <HelvionLogo
                  variant="dark"
                  alt={APP_NAME}
                  heightClassName="h-7"
                  className="opacity-95 transition-opacity duration-200 group-hover:opacity-100"
                />
              </Link>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed max-w-[220px]">
                {t("footer.tagline")}
              </p>
              <div className="flex gap-2 mt-5">
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                  aria-label="Twitter"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                  aria-label="LinkedIn"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                  aria-label="GitHub"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
              </div>
              <Link
                href="/status"
                className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-slate-800/80 text-xs font-medium text-emerald-400 border border-slate-700"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t("home.systemOperational")}
              </Link>
            </div>

            {/* Directory columns */}
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.headingKey}>
                <h4 className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider mb-4">
                  {t(col.headingKey as Parameters<typeof t>[0])}
                </h4>
                <ul className="space-y-3 text-sm">
                  {col.links.map((link) => (
                    <li key={link.labelKey + link.href}>
                      <Link
                        href={link.href}
                        className="text-slate-400 hover:text-white transition-colors"
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
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500" suppressHydrationWarning>
              © {new Date().getFullYear()} {APP_NAME} · Vertex Digital Systems LLC — Wyoming, USA
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-500 border border-slate-700">
                GDPR
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-500 border border-slate-700">
                SSL
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-500 border border-slate-700">
                SOC2
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
