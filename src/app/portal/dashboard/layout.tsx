import { redirect } from "next/navigation";
import { getPortalSessionServer } from "@/lib/portal-session";
import { PortalSidebar } from "@/components/portal/portal-sidebar";

export default async function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSessionServer();

  if (!session) {
    redirect("/portal");
  }

  return (
    <div
      className="min-h-screen dashboard-bg"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <PortalSidebar
        clientName={session.clientName}
        clientEmail={session.email}
      />
      <main className="sidebar-content px-4 md:px-6 lg:px-8 py-6 pt-16 md:pt-6 relative z-10">
        {children}
      </main>
    </div>
  );
}
