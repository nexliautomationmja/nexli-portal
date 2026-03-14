import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { NotificationProvider } from "@/components/dashboard/notification-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "admin";

  return (
    <div
      className="min-h-screen dashboard-bg"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <NotificationProvider>
        <Sidebar isAdmin={isAdmin} userName={session.user.name} />
        <main className="sidebar-content px-4 md:px-6 lg:px-8 py-6 pt-16 md:pt-6 relative z-10">
          {children}
        </main>
      </NotificationProvider>
    </div>
  );
}
