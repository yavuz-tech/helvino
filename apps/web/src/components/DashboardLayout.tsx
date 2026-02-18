"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Building2,
  Plus,
  FileText,
  ShieldAlert,
  Tag,
  MessageCircle,
  Palette,
} from "lucide-react";
import { useOrg } from "@/contexts/OrgContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CampaignTopBanner from "@/components/CampaignTopBanner";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import ErrorBoundary from "@/components/ErrorBoundary";
import HelvionLogo from "@/components/brand/HelvionLogo";

interface NavItemDef {
  labelKey: TranslationKey;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const navItemDefs: NavItemDef[] = [
  { labelKey: "nav.overview", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.organizations", href: "/dashboard/orgs", icon: Building2 },
  { labelKey: "nav.settings", href: "/dashboard/settings", icon: Settings },
  { labelKey: "nav.campaigns", href: "/dashboard/campaigns", icon: Tag },
  { labelKey: "nav.landingWidget", href: "/dashboard/landing-widget", icon: MessageCircle },
  { labelKey: "nav.widget", href: "/dashboard/widget", icon: MessageCircle },
  { labelKey: "nav.widgetAppearance", href: "/dashboard/widget-appearance", icon: Palette },
  { labelKey: "nav.security", href: "/dashboard/settings/security", icon: Shield },
  { labelKey: "nav.auditLog", href: "/dashboard/audit", icon: FileText },
  { labelKey: "nav.recovery", href: "/dashboard/recovery", icon: ShieldAlert },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: {
    email: string;
    role: string;
  } | null;
  onLogout?: () => void;
}

export default function DashboardLayout({
  children,
  user,
  onLogout,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const pathname = usePathname();
  const { organizations, selectedOrg, selectOrg, isLoading: orgLoading } = useOrg();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[#FFFBF5]">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[260px] bg-white border-r border-[#F3E8D8] transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#F3E8D8]">
          <Link href="/" className="flex items-center" aria-label="Helvion">
            <HelvionLogo variant="light" heightClassName="h-7" />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden hover:bg-amber-50 rounded-lg p-1.5 transition-colors"
          >
            <X size={18} strokeWidth={2} className="text-[#64748B]" />
          </button>
        </div>

        {/* Organization Selector */}
        <div className="p-3 border-b border-[#F3E8D8]">
          <div className="relative">
            <button
              onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
              className="w-full flex items-center justify-between gap-2.5 px-3.5 py-3 rounded-xl bg-[#FFFBF5]/80 hover:bg-amber-50 transition-all duration-150"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0">
                  <Building2 size={14} className="text-[#475569]" strokeWidth={2} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  {orgLoading ? (
                    <p className="text-xs text-[#64748B]">{t("common.loading")}</p>
                  ) : selectedOrg ? (
                    <>
                      <p className="text-sm font-medium text-[#1A1D23] truncate">
                        {selectedOrg.name}
                      </p>
                      <p className="text-[11px] text-[#94A3B8] truncate">{selectedOrg.key}</p>
                    </>
                  ) : (
                    <p className="text-xs text-[#64748B]">{t("dashboard.noOrg")}</p>
                  )}
                </div>
              </div>
              <ChevronDown
                size={14}
                className={`text-[#94A3B8] transition-transform duration-150 ${
                  orgDropdownOpen ? "rotate-180" : ""
                }`}
                strokeWidth={2}
              />
            </button>

            {/* Dropdown */}
            {orgDropdownOpen && !orgLoading && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#F3E8D8] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-50 max-h-64 overflow-y-auto">
                {organizations.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-[#64748B] text-center">
                    {t("dashboard.noOrganizations")}
                  </div>
                ) : (
                  organizations.map((org) => (
                    <button
                      key={org.key}
                      onClick={() => {
                        selectOrg(org.key);
                        setOrgDropdownOpen(false);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#FFFBF5] transition-colors text-left ${
                        selectedOrg?.key === org.key ? "bg-amber-50" : ""
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                        <Building2 size={12} className="text-[#64748B]" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1D23] truncate">
                          {org.name}
                        </p>
                        <p className="text-[11px] text-[#94A3B8] truncate">{org.key}</p>
                      </div>
                      {selectedOrg?.key === org.key && (
                        <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
                <div className="border-t border-[#F3E8D8]">
                  <Link
                    href="/dashboard/orgs/new"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#FFFBF5] transition-colors text-[#475569]"
                    onClick={() => {
                      setOrgDropdownOpen(false);
                      setSidebarOpen(false);
                    }}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                      <Plus size={12} className="text-[#64748B]" strokeWidth={2} />
                    </div>
                    <span className="text-sm font-medium">{t("nav.createOrg")}</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-0.5">
          {navItemDefs.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 ${
                  isActive
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-[0_1px_3px_rgba(245,158,11,0.3)]"
                    : "text-[#475569] hover:bg-amber-50 hover:text-[#1A1D23]"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[13px] font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#F3E8D8]">
          {user && (
            <div className="px-3 py-2 text-xs">
              <p className="text-[#94A3B8]">{t("auth.loggedInAs")}</p>
              <p className="font-medium text-[#1A1D23] truncate">{user.email}</p>
              <p className="text-[#94A3B8]">({user.role})</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-[260px]">
        {/* Top Bar */}
        <header className="relative h-16 bg-white/90 backdrop-blur-md border-b border-[#F3E8D8] flex items-center px-6 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="relative z-[2] lg:hidden hover:bg-amber-50 rounded-lg p-2 transition-colors"
          >
            <Menu size={20} strokeWidth={2} className="text-[#64748B]" />
          </button>

          {/* Campaign gradient — admin also sees global campaigns */}
          <div className="hidden lg:contents">
            <CampaignTopBanner source="admin" variant="inline" orgKey={selectedOrg?.key} />
          </div>

          <div className="relative z-[2] flex items-center gap-2 ml-auto">
            <LanguageSwitcher />
            {user && (
              <>
                <div className="hidden sm:block text-right mr-1">
                  <p className="text-sm font-medium text-[#1A1D23] leading-tight">{user.email}</p>
                  <p className="text-[11px] text-[#94A3B8]">{user.role}</p>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
                  <span className="text-xs font-bold text-[#475569]">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#64748B] hover:bg-amber-50 hover:text-[#1A1D23] rounded-xl transition-all duration-150"
                    title={t("common.logout")}
                  >
                    <LogOut size={15} strokeWidth={2} />
                    <span className="hidden sm:inline text-xs font-medium">{t("common.logout")}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        {/* Mobile campaign banner */}
        <div className="lg:hidden">
          <CampaignTopBanner source="admin" orgKey={selectedOrg?.key} />
        </div>

        {/* Page Content */}
        <ErrorBoundary>
          <main className="p-5 sm:p-6">{children}</main>
        </ErrorBoundary>
      </div>
    </div>
  );
}
