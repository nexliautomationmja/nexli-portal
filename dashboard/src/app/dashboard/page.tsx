import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { OverviewClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firstName = session.user.name?.split(" ")[0] || "there";
  const userId = session.user.id!;

  // Get document stats server-side
  const statusCounts = await db
    .select({
      status: documents.status,
      count: sql<number>`count(*)`,
    })
    .from(documents)
    .where(eq(documents.ownerId, userId))
    .groupBy(documents.status);

  const docStats = { total: 0, new: 0, reviewed: 0, archived: 0 };
  for (const row of statusCounts) {
    const count = Number(row.count);
    docStats.total += count;
    if (row.status === "new") docStats.new = count;
    if (row.status === "reviewed") docStats.reviewed = count;
    if (row.status === "archived") docStats.archived = count;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-main)" }}
        >
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Your document portal and CRM overview.
        </p>
      </div>

      <OverviewClient
        docStats={docStats}
        isAdmin={session.user.role === "admin"}
      />
    </div>
  );
}
