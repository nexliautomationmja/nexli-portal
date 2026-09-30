import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/dashboard/sidebar";
import { NotificationProvider } from "@/components/dashboard/notification-provider";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import {
  BILLING_PAUSED_PATH,
  isAgencyRoute,
  isSubscriptionActive,
  normalizeTier,
} from "@/lib/tier-access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Tier and billing state come from the DB, not the JWT: the JWT lives 30
  // days and would otherwise let a paused firm keep using the dashboard.
  const [account] = await db
    .select({
      role: users.role,
      tier: users.tier,
      subscriptionStatus: users.subscriptionStatus,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const role = account?.role ?? session.user.role;
  const isAdmin = role === "admin";
  const tier = normalizeTier(account?.tier);
  const isFoundationClient = !isAdmin && tier === "foundation";

  // Current pathname is forwarded by middleware as a request header.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const onBillingPausedPage = pathname === BILLING_PAUSED_PATH;

  // Paused Foundation firms only get the billing-paused page (which never
  // redirects itself, so there is no loop). Admin and DRS bypass.
  if (
    isFoundationClient &&
    !isSubscriptionActive(account?.subscriptionStatus)
  ) {
    if (!onBillingPausedPage) redirect(BILLING_PAUSED_PATH);
    // Render without the sidebar so the paused page stands alone.
    return <>{children}</>;
  }

  // Active (or non-Foundation) users never need the paused page.
  if (onBillingPausedPage) redirect("/dashboard");

  // Foundation firms don't have the agency tooling; bounce to Overview.
  if (isFoundationClient && isAgencyRoute(pathname)) {
    redirect("/dashboard");
  }

  return (
    <div
      className="min-h-screen dashboard-bg"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <NotificationProvider>
        <Sidebar isAdmin={isAdmin} tier={tier} userName={session.user.name} />
        <main className="sidebar-content px-4 md:px-6 lg:px-8 py-6 pt-16 md:pt-6 relative z-10">
          {isFoundationClient && <UpgradeBanner />}
          {children}
        </main>
      </NotificationProvider>
    </div>
  );
}
