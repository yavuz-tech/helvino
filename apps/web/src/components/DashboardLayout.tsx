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
} from "lucide-react";
import { useOrg } from "@/contexts/OrgContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Security", href: "/dashboard/settings/security", icon: Shield },
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
            <span className="font-bold text-lg text-slate-900">Helvino</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden hover:bg-slate-100 rounded-lg p-1.5 transition-colors"
          >
            <X size={20} strokeWidth={2} className="text-slate-600" />
          </button>
        </div>

        {/* Organization Selector */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <button
              onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <Building2 size={16} className="text-slate-600" strokeWidth={2} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  {orgLoading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : selectedOrg ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {selectedOrg.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{selectedOrg.key}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No organization</p>
                  )}
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${
                  orgDropdownOpen ? "rotate-180" : ""
                }`}
                strokeWidth={2}
              />
            </button>

            {/* Dropdown */}
            {orgDropdownOpen && !orgLoading && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                {organizations.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center">
                    No organizations
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
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left ${
                        selectedOrg?.key === org.key ? "bg-slate-50" : ""
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Building2 size={14} className="text-slate-600" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {org.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{org.key}</p>
                      </div>
                      {selectedOrg?.key === org.key && (
                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                      )}
                    </button>
                  ))
                )}
                <div className="border-t border-slate-200">
                  <Link
                    href="/dashboard/orgs/new"
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-slate-700"
                    onClick={() => {
                      setOrgDropdownOpen(false);
                      setSidebarOpen(false);
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Plus size={14} className="text-slate-600" strokeWidth={2} />
                    </div>
                    <span className="text-sm font-medium">Create Organization</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
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
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
          {user && (
            <div className="px-4 py-2 text-xs">
              <p className="text-slate-600">Logged in as</p>
              <p className="font-medium text-slate-900">{user.email}</p>
              <p className="text-slate-500">({user.role})</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden hover:bg-slate-100 rounded-lg p-2"
          >
            <Menu size={20} strokeWidth={2} className="text-slate-600" />
          </button>

          <div className="flex items-center gap-3 ml-auto">
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
                    title="Logout"
                  >
                    <LogOut size={18} strokeWidth={2} />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
