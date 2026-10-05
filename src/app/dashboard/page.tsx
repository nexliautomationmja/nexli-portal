import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { OverviewClient } from "./dashboard-client";
import { FoundationProjectCard } from "@/components/portal/foundation-project-card";
import {
  getFoundationProjectForEmail,
  type FoundationProject,
} from "@/lib/foundation-project";
import { getClientSuccessForUser, type LatestUpdate } from "@/lib/client-success";
import { WeeklyUpdateCard } from "@/components/dashboard/weekly-update-card";
import { SurveyPromptCard } from "@/components/dashboard/survey-prompt-card";
import { GuaranteeProgressCard } from "@/components/dashboard/guarantee-progress-card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firstName = session.user.name?.split(" ")[0] || "there";
  const userId = session.user.id!;

  // Digital Rainmaker clients (tier null or "drs") see the latest weekly
  // update from their Nexli team and this week's pulse check, if still open.
  let latestUpdate: LatestUpdate | null = null;
  let pendingSurvey: { token: string; weekStart: string } | null = null;
  if (session.user.role === "client" && session.user.tier !== "foundation") {
    try {
      ({ latestUpdate, pendingSurvey } = await getClientSuccessForUser(userId));
    } catch (err) {
      console.warn("[dashboard] client success lookup failed:", err);
    }
  }

  // Firm Foundation owners see their build progress on their own dashboard too.
  let foundationProject: FoundationProject | null = null;
  if (
    session.user.role === "client" &&
    session.user.tier === "foundation" &&
    session.user.email
  ) {
    try {
      foundationProject = await getFoundationProjectForEmail(session.user.email);
    } catch (err) {
      console.warn("[dashboard] foundation project lookup failed:", err);
    }
  }

  // Get document stats server-side. Defensive: if the DB is briefly
  // unreachable, fall back to zeroed stats so the landing page still renders
  // (the client widgets below fetch via API and handle their own errors)
  // instead of taking down the whole dashboard.
  const docStats = { total: 0, new: 0, reviewed: 0, archived: 0 };
  try {
    const statusCounts = await db
      .select({
        status: documents.status,
        count: sql<number>`count(*)`,
      })
      .from(documents)
      .where(eq(documents.ownerId, userId))
      .groupBy(documents.status);

    for (const row of statusCounts) {
      const count = Number(row.count);
      docStats.total += count;
      if (row.status === "new") docStats.new = count;
      if (row.status === "reviewed") docStats.reviewed = count;
      if (row.status === "archived") docStats.archived = count;
    }
  } catch (err) {
    console.error("Dashboard overview: document stats query failed:", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-main)" }}
        >
          Welcome back, <span className="text-gradient">{firstName}</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Your document portal and CRM overview.
        </p>
      </div>

      {foundationProject && (
        <FoundationProjectCard project={foundationProject} showDashboardLink={false} />
      )}

      {pendingSurvey && <SurveyPromptCard token={pendingSurvey.token} />}
      {session.user.role === "client" && session.user.tier !== "foundation" && (
        <GuaranteeProgressCard />
      )}
      {latestUpdate && <WeeklyUpdateCard update={latestUpdate} />}

      <OverviewClient
        docStats={docStats}
        isAdmin={session.user.role === "admin"}
      />
    </div>
  );
}
