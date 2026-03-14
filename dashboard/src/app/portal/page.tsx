import { Suspense } from "react";
import { NexliLogo } from "@/components/ui/nexli-logo";
import { MagicLinkForm } from "@/components/portal/magic-link-form";

export const metadata = {
  title: "Client Portal | Nexli",
};

export default function PortalLoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, #2563EB 0%, #06B6D4 50%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <NexliLogo size="lg" />
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Client Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 md:p-10">
          <Suspense fallback={<div className="py-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>}>
            <MagicLinkForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p
          className="text-center mt-6 text-xs"
          style={{ color: "var(--text-muted)", opacity: 0.5 }}
        >
          Protected by Nexli Automation
        </p>
      </div>
    </div>
  );
}
