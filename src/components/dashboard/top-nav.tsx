"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import {
  LayoutIcon,
  ChartIcon,
  FileIcon,
  GearIcon,
  UsersIcon,
  SunIcon,
  MoonIcon,
  LogOutIcon,
  HamburgerIcon,
  XIcon,
  ImageIcon,
} from "@/components/ui/icons";

interface TopNavProps {
  isAdmin: boolean;
  userName?: string | null;
}

const clientNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutIcon },
  { href: "/dashboard/analytics", label: "Analytics", icon: ChartIcon },
  { href: "/dashboard/reports", label: "Reports", icon: FileIcon },
  { href: "/dashboard/brand-files", label: "Brand Files", icon: ImageIcon },
  { href: "/dashboard/settings", label: "Settings", icon: GearIcon },
];

const adminNav = [
  { href: "/dashboard/admin", label: "All Clients", icon: UsersIcon },
];

export function TopNav({ isAdmin, userName }: TopNavProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navItems = isAdmin ? [...clientNav, ...adminNav] : clientNav;

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 glass-topnav">
        <div className="max-w-7xl mx-auto h-16 px-4 md:px-6 flex items-center justify-between">
          {/* Logo chip — matches nexli.net main site exactly */}
          <Link
            href="/dashboard"
            className={`shrink-0 flex items-center gap-2 cursor-pointer backdrop-blur-md px-4 py-2 rounded-full border no-underline transition-colors duration-300 ${
              theme === "dark"
                ? "bg-black/20 border-white/5"
                : "bg-[var(--glass-bg)] border-[var(--glass-border)]"
            }`}
          >
            {theme === "dark" ? (
              <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
                <defs>
                  <linearGradient id="logo-grad-topnav" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
                <path d="M4 36L20 24L4 12L4 20L12 24L4 28L4 36Z" fill="#2563EB" />
                <path d="M12 36L28 24L12 12L12 18L18 24L12 30L12 36Z" fill="url(#logo-grad-topnav)" />
                <path d="M20 36L44 24L20 12L20 18L32 24L20 30L20 36Z" fill="#06B6D4" />
              </svg>
            ) : (
              <img
                src="/logos/icon-light.svg"
                alt="Nexli"
                className="w-8 h-8"
              />
            )}
            <span
              className="text-xl font-black tracking-tighter text-[var(--text-main)]"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              NEXLI
            </span>
          </Link>

          {/* Desktop nav pill */}
          <nav
            className="hidden md:flex items-center rounded-full border border-[var(--glass-border)] px-2 py-1"
            style={{ background: "var(--glass-bg)" }}
          >
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
                    "relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-white"
                      : "hover:text-[var(--text-main)]"
                  )}
                  style={{
                    color: isActive ? undefined : "var(--text-muted)",
                    background: isActive
                      ? "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(6,182,212,0.3))"
                      : undefined,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full flex items-center justify-center border border-[var(--glass-border)] transition-all duration-200 hover:border-blue-500/30"
              style={{ color: "var(--text-muted)", background: "var(--glass-bg)" }}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <SunIcon className="w-4 h-4" />
              ) : (
                <MoonIcon className="w-4 h-4" />
              )}
            </button>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border border-[var(--glass-border)] transition-all duration-200 hover:border-blue-500/30"
                style={{ background: "var(--glass-bg)" }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: "linear-gradient(135deg, #2563EB, #06B6D4)",
                    color: "white",
                  }}
                >
                  {initials}
                </div>
                {isAdmin && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">
                    Admin
                  </span>
                )}
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-2xl glass-card p-2 space-y-1">
                    {userName && (
                      <div className="px-3 py-2 border-b border-[var(--glass-border)]">
                        <p
                          className="text-xs font-medium truncate"
                          style={{ color: "var(--text-main)" }}
                        >
                          {userName}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOutIcon className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden ml-auto">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-9 h-9 rounded-full flex items-center justify-center border border-[var(--glass-border)]"
              style={{ color: "var(--text-muted)", background: "var(--glass-bg)" }}
            >
              {mobileOpen ? (
                <XIcon className="w-4 h-4" />
              ) : (
                <HamburgerIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[var(--glass-border)]">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-500/10 text-blue-400"
                        : "hover:bg-[var(--glass-bg)]"
                    )}
                    style={{
                      color: isActive ? undefined : "var(--text-muted)",
                    }}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="border-t border-[var(--glass-border)] pt-2 mt-2 space-y-1">
                <button
                  onClick={() => {
                    toggleTheme();
                    setMobileOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full hover:bg-[var(--glass-bg)] transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  {theme === "dark" ? (
                    <SunIcon className="w-4 h-4" />
                  ) : (
                    <MoonIcon className="w-4 h-4" />
                  )}
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOutIcon className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
