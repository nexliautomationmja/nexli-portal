import Link from "next/link";
import { NexliLogo } from "@/components/ui/nexli-logo";
import { peekPasswordSetupToken } from "@/lib/password-setup";
import { SetupPasswordForm } from "./setup-password-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set Your Password | Nexli Dashboard",
};

export default async function SetupPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let valid = false;
  try {
    valid = (await peekPasswordSetupToken(token)) !== null;
  } catch {
    valid = false;
  }

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
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            {valid ? "Choose a password for your dashboard" : "Password setup"}
          </p>
        </div>

        <div className="glass-card p-8 md:p-10">
          {valid ? (
            <SetupPasswordForm token={token} />
          ) : (
            <div className="space-y-4 text-center">
              <h1
                className="text-lg font-bold"
                style={{ color: "var(--text-main)" }}
              >
                This link is invalid or has expired
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Password setup links work once and expire after a few days.
                Contact Nexli to have a new welcome email sent.
              </p>
              <Link
                href="/login"
                className="inline-block mt-2 font-medium no-underline hover:underline"
                style={{ color: "var(--accent-blue)" }}
              >
                Go to sign in
              </Link>
            </div>
          )}
        </div>

        <p
          className="text-center mt-4 text-xs"
          style={{ color: "var(--text-muted)", opacity: 0.5 }}
        >
          Protected by Nexli Automation
        </p>
      </div>
    </div>
  );
}
