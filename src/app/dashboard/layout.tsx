import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileHeader } from "@/components/dashboard/header";

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
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      {/* Mobile header */}
      <MobileHeader isAdmin={isAdmin} userName={session.user.name} />

      <div className="flex h-screen">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-64 p-3 shrink-0">
          <Sidebar isAdmin={isAdmin} userName={session.user.name} />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pt-16 md:pt-0 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
