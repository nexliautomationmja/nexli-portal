"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import {
  LayoutIcon,
  InvoiceIcon,
  FileIcon,
  PenLineIcon,
  KanbanIcon,
  SunIcon,
  MoonIcon,
  LogOutIcon,
  HamburgerIcon,
  XIcon,
} from "@/components/ui/icons";

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

interface PortalSidebarProps {
  clientName: string | null;
  clientEmail: string;
}

const portalNav: { href: string; label: string; icon: typeof LayoutIcon }[] = [
  { href: "/portal/dashboard", label: "Overview", icon: LayoutIcon },
  { href: "/portal/dashboard/invoices", label: "Invoices", icon: InvoiceIcon },
  { href: "/portal/dashboard/documents", label: "Documents", icon: FileIcon },
  { href: "/portal/dashboard/engagements", label: "Engagements", icon: PenLineIcon },
  { href: "/portal/dashboard/tax-returns", label: "Tax Returns", icon: KanbanIcon },
];

export function PortalSidebar({ clientName, clientEmail }: PortalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const initials = clientName
    ? clientName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : clientEmail.slice(0, 2).toUpperCase();

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

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/portal/auth/sign-out", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/portal");
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4", collapsed ? "justify-center" : "gap-3")}>
        <Link href="/portal/dashboard" className="flex items-center no-underline shrink-0">
          <img
            src={theme === "dark" ? "/logos/nexli-logo-white-wordmark@2x.png" : "/logos/nexli-logo-dark-wordmark@2x.png"}
            alt="Nexli"
            className={cn("w-auto shrink-0", collapsed ? "h-6" : "h-7")}
          />
        </Link>
      </div>

      {/* Portal label */}
      {!collapsed && (
        <div className="px-4 mb-2">
          <span
            className="text-[9px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--accent-blue)" }}
          >
            Client Portal
          </span>
        </div>
      )}

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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5 no-scrollbar">
        {portalNav.map((item) => {
          const isActive =
            item.href === "/portal/dashboard"
              ? pathname === "/portal/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg text-sm font-medium transition-colors no-underline",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                isActive
                  ? "sidebar-nav-active sidebar-active-text"
                  : "hover:bg-[var(--input-bg)]"
              )}
              style={{
                color: isActive ? undefined : "var(--text-muted)",
              }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-[var(--text-main)]" : "")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-[var(--card-border)] pt-3 mt-2">
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
              {clientName && (
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-main)" }}
                >
                  {clientName}
                </p>
              )}
              <p
                className="text-xs truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {clientEmail}
              </p>
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOutIcon className="w-5 h-5 shrink-0" />
          {!collapsed && <span>{signingOut ? "Signing out..." : "Sign Out"}</span>}
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
