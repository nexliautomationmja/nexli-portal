import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/dashboard/top-nav";

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
      <TopNav isAdmin={isAdmin} userName={session.user.name} />
      <main className="pt-20 px-4 md:px-6 pb-8">{children}</main>
    </div>
  );
}
