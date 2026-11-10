import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { documents, users } from "@/db/schema";
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
import { CampaignProgressCard } from "@/components/dashboard/campaign-progress-card";

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

  // Whether this account has GoHighLevel connected, so the Overview can say
  // "Connect GoHighLevel" instead of showing zeros that look real.
  let ghlConnected = false;
  try {
    const [row] = await db.select({ ghlLocationId: users.ghlLocationId }).from(users).where(eq(users.id, userId)).limit(1);
    ghlConnected = Boolean(row?.ghlLocationId);
  } catch (err) {
    console.warn("[dashboard] GHL connection lookup failed:", err);
  }

  const isDrsClient = session.user.role === "client" && session.user.tier !== "foundation";
  const role = session.user.role === "admin" ? "admin" : session.user.tier === "foundation" ? "foundation" : "drs";

  return (
    <OverviewClient
      firstName={firstName}
      role={role}
      ghlConnected={ghlConnected}
      docStats={docStats}
      thisWeek={
        pendingSurvey || latestUpdate ? (
          <>
            {pendingSurvey && <SurveyPromptCard token={pendingSurvey.token} />}
            {latestUpdate && <WeeklyUpdateCard update={latestUpdate} />}
          </>
        ) : undefined
      }
      campaign={isDrsClient ? <CampaignProgressCard /> : undefined}
      build={foundationProject ? <FoundationProjectCard project={foundationProject} showDashboardLink={false} /> : undefined}
    />
  );
}
