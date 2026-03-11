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
  FileIcon,
  FormIcon,
  GearIcon,
  ShieldIcon,
  SunIcon,
  MoonIcon,
  LogOutIcon,
  HamburgerIcon,
  XIcon,
} from "@/components/ui/icons";

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

// Color map matching nexli.net icon box styling
const colorMap = {
  blue: {
    iconDark: "bg-blue-500/10 border-blue-500/20",
    iconLight: "bg-blue-50 border-blue-200",
    text: "text-blue-400",
    glow: "drop-shadow(0 0 8px rgba(37, 99, 235, 0.4))",
  },
  cyan: {
    iconDark: "bg-cyan-500/10 border-cyan-500/20",
    iconLight: "bg-cyan-50 border-cyan-200",
    text: "text-cyan-400",
    glow: "drop-shadow(0 0 8px rgba(6, 182, 212, 0.4))",
  },
  violet: {
    iconDark: "bg-violet-500/10 border-violet-500/20",
    iconLight: "bg-violet-50 border-violet-200",
    text: "text-violet-400",
    glow: "drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))",
  },
  emerald: {
    iconDark: "bg-emerald-500/10 border-emerald-500/20",
    iconLight: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-400",
    glow: "drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))",
  },
  teal: {
    iconDark: "bg-teal-500/10 border-teal-500/20",
    iconLight: "bg-teal-50 border-teal-200",
    text: "text-teal-400",
    glow: "drop-shadow(0 0 8px rgba(20, 184, 166, 0.4))",
  },
  amber: {
    iconDark: "bg-amber-500/10 border-amber-500/20",
    iconLight: "bg-amber-50 border-amber-200",
    text: "text-amber-400",
    glow: "drop-shadow(0 0 8px rgba(245, 158, 11, 0.4))",
  },
  rose: {
    iconDark: "bg-rose-500/10 border-rose-500/20",
    iconLight: "bg-rose-50 border-rose-200",
    text: "text-rose-400",
    glow: "drop-shadow(0 0 8px rgba(244, 63, 94, 0.4))",
  },
  indigo: {
    iconDark: "bg-indigo-500/10 border-indigo-500/20",
    iconLight: "bg-indigo-50 border-indigo-200",
    text: "text-indigo-400",
    glow: "drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))",
  },
} as const;

type AccentColor = keyof typeof colorMap;

const clientNav: { href: string; label: string; icon: typeof LayoutIcon; color: AccentColor }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutIcon, color: "blue" },
  { href: "/dashboard/contacts", label: "Contacts", icon: UsersIcon, color: "violet" },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: KanbanIcon, color: "cyan" },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarIcon, color: "amber" },
  { href: "/dashboard/messages", label: "Messages", icon: MessageIcon, color: "emerald" },
  { href: "/dashboard/documents", label: "Documents", icon: FileIcon, color: "teal" },
  { href: "/dashboard/tax-forms", label: "Tax Center", icon: FormIcon, color: "indigo" },
  { href: "/dashboard/settings", label: "Settings", icon: GearIcon, color: "rose" },
];

const adminNav: { href: string; label: string; icon: typeof ShieldIcon; color: AccentColor }[] = [
  { href: "/dashboard/admin", label: "All Clients", icon: ShieldIcon, color: "amber" },
];

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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile drawer is open
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

  // Set data attribute for layout margin adjustment
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
        <Link href="/dashboard" className="flex items-center gap-2 no-underline shrink-0">
          {theme === "dark" ? (
            <svg className="w-8 h-8 shrink-0" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="logo-grad-sidebar" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              <path d="M4 36L20 24L4 12L4 20L12 24L4 28L4 36Z" fill="#2563EB" />
              <path d="M12 36L28 24L12 12L12 18L18 24L12 30L12 36Z" fill="url(#logo-grad-sidebar)" />
              <path d="M20 36L44 24L20 12L20 18L32 24L20 30L20 36Z" fill="#06B6D4" />
            </svg>
          ) : (
            <img src="/logos/icon-light.svg" alt="Nexli" className="w-8 h-8 shrink-0" />
          )}
          {!collapsed && (
            <span
              className="text-xl font-black tracking-tighter text-[var(--text-main)]"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              NEXLI
            </span>
          )}
        </Link>
      </div>

      {/* Collapse toggle — desktop only */}
      <div className="hidden md:flex px-3 mb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center h-8 rounded-lg border border-[var(--glass-border)] hover:border-blue-500/30 transition-all duration-200"
          style={{ color: "var(--text-muted)", background: "var(--glass-bg)" }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRightIcon className="w-4 h-4" />
          ) : (
            <ChevronLeftIcon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1.5 no-scrollbar">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const colors = colorMap[item.color];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 no-underline",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                isActive
                  ? "sidebar-nav-active"
                  : "hover:bg-[var(--glass-bg)] sidebar-nav-item"
              )}
              style={{
                color: isActive ? undefined : "var(--text-muted)",
              }}
              title={collapsed ? item.label : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full sidebar-active-bar" />
              )}
              {/* Icon box — colored rounded square like nexli.net */}
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-all duration-200",
                  theme === "dark" ? colors.iconDark : colors.iconLight,
                  isActive && "group-hover:scale-110",
                  !isActive && "group-hover:scale-105"
                )}
                style={{
                  filter: isActive ? colors.glow : undefined,
                }}
              >
                <item.icon className={cn("w-4 h-4", colors.text)} />
              </div>
              {!collapsed && (
                <span className={cn(
                  "transition-colors duration-200",
                  isActive ? "sidebar-active-text" : "group-hover:text-[var(--text-main)]"
                )}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-1.5 border-t border-[var(--glass-border)] pt-3 mt-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "group w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-[var(--glass-bg)]",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
          style={{ color: "var(--text-muted)" }}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-all duration-200 group-hover:scale-105",
            theme === "dark"
              ? "bg-amber-500/10 border-amber-500/20"
              : "bg-indigo-50 border-indigo-200"
          )}>
            {theme === "dark" ? (
              <SunIcon className="w-4 h-4 text-amber-400" />
            ) : (
              <MoonIcon className="w-4 h-4 text-indigo-400" />
            )}
          </div>
          {!collapsed && (
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          )}
        </button>

        {/* User section */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl",
            collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
          )}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
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
            "group w-full flex items-center gap-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-all duration-200 group-hover:scale-105",
            theme === "dark"
              ? "bg-red-500/10 border-red-500/20"
              : "bg-red-50 border-red-200"
          )}>
            <LogOutIcon className="w-4 h-4" />
          </div>
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
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center glass-card border border-[var(--glass-border)]"
        style={{ color: "var(--text-muted)" }}
      >
        <HamburgerIcon className="w-5 h-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
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
        {/* Close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--glass-bg)] transition-colors"
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
        {/* Gradient accent line on right edge */}
        <div className="absolute right-0 top-0 h-full w-[1px] sidebar-gradient-border" />
        {sidebarContent}
      </aside>
    </>
  );
}
