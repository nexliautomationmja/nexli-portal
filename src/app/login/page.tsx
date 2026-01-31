import { LoginForm } from "@/components/auth/login-form";
import { NexliLogo } from "@/components/ui/nexli-logo";

export const metadata = {
  title: "Sign In | Nexli Dashboard",
};

export default function LoginPage() {
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
          <NexliLogo iconSize="w-10 h-10" textSize="text-2xl" />
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sign in to your dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 md:p-10 rounded-2xl md:rounded-[2rem]">
          <LoginForm />
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
