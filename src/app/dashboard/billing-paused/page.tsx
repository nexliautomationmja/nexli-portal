import type { Metadata } from "next";
import { NexliLogo } from "@/components/ui/nexli-logo";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Subscription Paused | Nexli Dashboard",
};

const SUPPORT_EMAIL = "support@nexli.net";

/**
 * Shown to Foundation-tier firms whose Stripe subscription is no longer
 * active. The dashboard layout redirects here and renders this page without
 * the sidebar; this page itself never redirects, so there is no loop.
 */
export default function BillingPausedPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <NexliLogo size="lg" />
        </div>

        <div className="glass-card p-8 md:p-10 text-center space-y-5">
          <div
            className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
            style={{ background: "rgba(245, 158, 11, 0.15)" }}
          >
            <svg
              className="w-7 h-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>

          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-main)" }}
          >
            Your subscription is paused
          </h1>

          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Access to your dashboard is on hold until billing is reactivated.
            Your client data, documents, and portal settings are safe and will
            be right where you left them.
          </p>

          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Reactivate%20my%20Nexli%20subscription`}
            className="inline-block w-full bg-blue-600 text-white px-6 py-3.5 rounded-full font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-500 active:scale-[0.98] transition-all duration-200 no-underline"
          >
            Contact {SUPPORT_EMAIL} to reactivate
          </a>

          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
