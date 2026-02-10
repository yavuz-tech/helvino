"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  Building2,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import CampaignTopBanner from "@/components/CampaignTopBanner";

interface NavItemDef {
  labelKey: TranslationKey;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const navItemDefs: NavItemDef[] = [
  { labelKey: "nav.conversations", href: "/org-app", icon: MessageSquare },
  { labelKey: "nav.settings", href: "/org-app/settings", icon: Settings },
  { labelKey: "nav.security", href: "/org-app/settings/security", icon: Shield },
];

interface OrgPortalLayoutProps {
  children: React.ReactNode;
  user?: {
    email: string;
    role: string;
    orgName: string;
    orgKey: string;
  } | null;
  onLogout?: () => void;
}

export default function OrgPortalLayout({
  children,
  user,
  onLogout,
}: OrgPortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <span className="font-bold text-lg text-slate-900">Helvion</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden hover:bg-slate-100 rounded-lg p-1.5 transition-colors"
          >
            <X size={20} strokeWidth={2} className="text-slate-600" />
          </button>
        </div>

        {/* Organization Info */}
        {user && (
          <div className="p-4 border-b border-slate-200">
            <div className="px-4 py-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={14} className="text-slate-600" strokeWidth={2} />
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user.orgName}
                </p>
              </div>
              <p className="text-xs text-slate-500 truncate">{user.orgKey}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItemDefs.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 hover:translate-x-0.5"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} strokeWidth={2} />
                <span className="font-medium text-sm">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
          {user && (
            <div className="px-4 py-2 text-xs">
              <p className="text-slate-600">{t("auth.loggedInAs")}</p>
              <p className="font-medium text-slate-900 truncate">{user.email}</p>
              <p className="text-slate-500">({user.role})</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="relative h-16 bg-white border-b border-slate-200 flex items-center px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="relative z-[2] lg:hidden hover:bg-slate-100 rounded-lg p-2"
          >
            <Menu size={20} strokeWidth={2} className="text-slate-600" />
          </button>

          {/* Campaign gradient — blends into header background */}
          <div className="hidden lg:contents">
            <CampaignTopBanner source="org" variant="inline" />
          </div>

          <div className="relative z-[2] flex items-center gap-3 ml-auto">
            <LanguageSwitcher />
            {user && (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{user.email}</p>
                  <p className="text-xs text-slate-500">{user.role}</p>
                </div>
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-slate-600">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title={t("common.logout")}
                  >
                    <LogOut size={18} strokeWidth={2} />
                    <span className="hidden sm:inline">{t("common.logout")}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        <div className="lg:hidden">
          <CampaignTopBanner source="org" />
        </div>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
