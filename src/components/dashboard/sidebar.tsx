"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import {
  LayoutIcon,
  UsersIcon,
  KanbanIcon,
  CalendarIcon,
  MessageIcon,
  SendIcon,
  FileIcon,
  PenLineIcon,
  InvoiceIcon,
  FormIcon,
  GearIcon,
  ChartIcon,
  ShieldIcon,
  RocketIcon,
  ScanIcon,
  SunIcon,
  MoonIcon,
  LogOutIcon,
  HamburgerIcon,
  XIcon,
} from "@/components/ui/icons";
import { NotificationBell } from "@/components/dashboard/notification-bell";

interface SidebarProps {
  isAdmin: boolean;
  userName?: string | null;
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

type NavAccent =
  | "blue"
  | "cyan"
  | "teal"
  | "violet"
  | "emerald"
  | "amber"
  | "neutral";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutIcon;
  accent: NavAccent;
}

// Icon chips follow the Digital Rainmaker color language:
// blue = website/core, violet = AI/automation, cyan = portal/centerpiece,
// amber = reviews/analysis, emerald = money, teal = misc.
const clientNav: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutIcon, accent: "blue" },
  { href: "/dashboard/clients", label: "Clients", icon: UsersIcon, accent: "cyan" },
  { href: "/dashboard/contacts", label: "Contacts", icon: UsersIcon, accent: "teal" },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: KanbanIcon, accent: "violet" },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarIcon, accent: "amber" },
  { href: "/dashboard/messages", label: "Messages", icon: MessageIcon, accent: "blue" },
  { href: "/dashboard/portal-messages", label: "Client Messages", icon: SendIcon, accent: "cyan" },
  { href: "/dashboard/documents", label: "Documents", icon: FileIcon, accent: "emerald" },
  { href: "/dashboard/engagements", label: "Engagements", icon: PenLineIcon, accent: "violet" },
  { href: "/dashboard/onboarding", label: "Onboarding", icon: RocketIcon, accent: "cyan" },
  { href: "/dashboard/contract-analyzer", label: "Contract Analyzer", icon: ScanIcon, accent: "amber" },
  { href: "/dashboard/invoices", label: "Invoices", icon: InvoiceIcon, accent: "emerald" },
  { href: "/dashboard/tax-returns", label: "Tax Returns", icon: KanbanIcon, accent: "blue" },
  { href: "/dashboard/tax-organizers", label: "Tax Organizers", icon: FormIcon, accent: "violet" },
  { href: "/dashboard/tax-forms", label: "Tax Center", icon: FormIcon, accent: "amber" },
  { href: "/dashboard/client-tracker", label: "Client Tracker", icon: ChartIcon, accent: "cyan" },
  { href: "/dashboard/settings", label: "Settings", icon: GearIcon, accent: "neutral" },
];

const adminNav: NavItem[] = [];

export function Sidebar({ isAdmin, userName }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = isAdmin ? [...clientNav, ...adminNav] : clientNav;

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-sidebar",
      collapsed ? "collapsed" : "expanded"
    );
    return () => {
      document.documentElement.removeAttribute("data-sidebar");
    };
  }, [collapsed]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4", collapsed ? "justify-center" : "gap-3")}>
        <Link href="/dashboard" className="flex items-center no-underline shrink-0">
          {collapsed ? (
            <img
              src={theme === "dark" ? "/logos/nexli-logo-white-wordmark@2x.png" : "/logos/nexli-logo-dark-wordmark@2x.png"}
              alt="Nexli"
              className="h-6 w-auto shrink-0"
            />
          ) : (
            <img
              src={theme === "dark" ? "/logos/nexli-logo-white-wordmark@2x.png" : "/logos/nexli-logo-dark-wordmark@2x.png"}
              alt="Nexli"
              className="h-7 w-auto shrink-0"
            />
          )}
        </Link>
      </div>

      {/* Collapse toggle — desktop only */}
      <div className="hidden md:flex px-3 mb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center h-8 rounded-lg border border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-colors"
          style={{ color: "var(--text-muted)" }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRightIcon className="w-4 h-4" />
          ) : (
            <ChevronLeftIcon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation — clean like Nextdoor */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5 no-scrollbar">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg text-sm font-medium transition-colors no-underline",
                collapsed ? "justify-center px-2 py-1.5" : "px-2.5 py-1.5",
                isActive
                  ? "sidebar-nav-active sidebar-active-text"
                  : "hover:bg-[var(--input-bg)]"
              )}
              style={{
                color: isActive ? undefined : "var(--text-muted)",
              }}
              title={collapsed ? item.label : undefined}
            >
              <span className={cn("icon-chip w-8 h-8", `icon-chip-${item.accent}`)}>
                <item.icon className="w-4 h-4" />
              </span>
              {!collapsed && (
                <span>{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-[var(--card-border)] pt-3 mt-2">
        {/* Notifications */}
        <NotificationBell collapsed={collapsed} />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--input-bg)]",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
          style={{ color: "var(--text-muted)" }}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? (
            <SunIcon className="w-5 h-5 shrink-0" />
          ) : (
            <MoonIcon className="w-5 h-5 shrink-0" />
          )}
          {!collapsed && (
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          )}
        </button>

        {/* User section */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg",
            collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
          )}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              background: "linear-gradient(135deg, #2563EB, #06B6D4)",
              color: "white",
            }}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              {userName && (
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-main)" }}
                >
                  {userName}
                </p>
              )}
              {isAdmin && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">
                  Admin
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOutIcon className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--card-bg)] border border-[var(--card-border)]"
        style={{ color: "var(--text-muted)" }}
      >
        <HamburgerIcon className="w-5 h-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-[70] h-full w-[260px] glass-sidebar transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--input-bg)] transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <XIcon className="w-4 h-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex fixed top-0 left-0 h-full z-40 glass-sidebar transition-all duration-300 ease-in-out flex-col",
          collapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
