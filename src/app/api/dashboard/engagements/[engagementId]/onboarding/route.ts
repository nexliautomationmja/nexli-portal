import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagements, engagementSigners } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  initOnboarding,
  setOnboardingValues,
  appendActivity,
  defaultTaskState,
  serializeAdminOnboarding,
  phaseIdsFor,
  PHASE_INFO,
  taskIdsFor,
  TASK_INFO,
  type OnboardingState,
  type PhaseId,
  type TaskId,
  type LicenseFileMeta,
} from "@/lib/onboarding";
import { getSupabase } from "@/lib/supabase";
import {
  getDrsBillingStatus,
  triggerDrsLaunchBilling,
  sendOnboardingWelcomeEmails,
  type DrsBillingStatus,
} from "@/lib/digital-rainmaker";

/** DRS billing sequence for the admin view; null when it can't be read. */
async function loadBilling(engagementId: string): Promise<DrsBillingStatus | null> {
  try {
    return await getDrsBillingStatus(engagementId);
  } catch (err) {
    console.error("DRS billing status failed:", err);
    return null;
  }
}

const LAUNCH_BILLING_ERRORS: Record<string, string> = {
  not_drs: "Monthly billing only applies to Digital Rainmaker engagements.",
  setup_unpaid: "The setup invoice hasn't been paid yet.",
  already_started: "The first monthly invoice was already sent.",
  no_signer: "This engagement has no client signer to bill.",
};

async function getOwnedEngagement(engagementId: string, ownerId: string) {
  const [engagement] = await db
    .select()
    .from(engagements)
    .where(
      and(eq(engagements.id, engagementId), eq(engagements.ownerId, ownerId))
    )
    .limit(1);
  return engagement || null;
}

/** "Oct 10, 2026" from a YYYY-MM-DD string (UTC, so the day never shifts). */
function formatDueDate(dateOnly: string): string {
  return new Date(`${dateOnly}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getOnboardingState(
  engagement: typeof engagements.$inferSelect
): OnboardingState | null {
  const metadata = (engagement.metadata || {}) as Record<string, unknown>;
  return (metadata.onboarding as OnboardingState | undefined) || null;
}

async function buildAdminResponse(
  engagementId: string,
  ownerId: string
): Promise<NextResponse> {
  const engagement = await getOwnedEngagement(engagementId, ownerId);
  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const state = getOnboardingState(engagement);
  if (!state) {
    // DRS: onboarding opens once the setup invoice is paid — include billing
    // so the UI can show where the client is.
    return NextResponse.json(
      { error: "Onboarding not started", billing: await loadBilling(engagementId) },
      { status: 404 }
    );
  }

  const serialized = serializeAdminOnboarding(state);

  // Enrich license files with short-lived signed URLs for admin review
  const licenseTask = serialized.tasks.find((t) => t.id === "drivers_license");
  const files = (licenseTask?.submission as {
    files?: Record<string, LicenseFileMeta | null>;
  } | null)?.files;
  const signedFiles: Record<
    string,
    (LicenseFileMeta & { signedUrl: string | null }) | null
  > = {};
  if (files) {
    const supabase = getSupabase();
    await Promise.all(
      (["front", "back"] as const).map(async (side) => {
        const meta = files[side];
        if (!meta) {
          signedFiles[side] = null;
          return;
        }
        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(meta.storagePath, 3600);
        signedFiles[side] = { ...meta, signedUrl: data?.signedUrl || null };
      })
    );
  }

  // Client-facing signer links (order >= 1)
  const signers = await db
    .select({
      id: engagementSigners.id,
      name: engagementSigners.name,
      email: engagementSigners.email,
      token: engagementSigners.token,
      order: engagementSigners.order,
      status: engagementSigners.status,
    })
    .from(engagementSigners)
    .where(eq(engagementSigners.engagementId, engagementId))
    .orderBy(engagementSigners.order);

  return NextResponse.json({
    engagementId,
    subject: engagement.subject,
    status: engagement.status,
    onboarding: {
      ...serialized,
      tasks: serialized.tasks.map((t) =>
        t.id === "drivers_license"
          ? { ...t, submission: { files: signedFiles } }
          : t
      ),
    },
    clientSigners: signers.filter((s) => s.order > 0),
    billing: await loadBilling(engagementId),
  });
}

// GET — full admin view (decrypted credentials, signed file URLs)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { engagementId } = await params;
  return buildAdminResponse(engagementId, session.user.id);
}

// POST — start onboarding for a signed engagement
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { engagementId } = await params;

  const engagement = await getOwnedEngagement(engagementId, session.user.id);
  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (engagement.status !== "signed") {
    return NextResponse.json(
      { error: "Onboarding can only be started for signed engagements." },
      { status: 409 }
    );
  }

  if (await initOnboarding(engagementId, "admin")) {
    await sendOnboardingWelcomeEmails(engagementId);
  }
  return buildAdminResponse(engagementId, session.user.id);
}

// PATCH — { action, ... } dispatch, each a targeted jsonb write.
//   { action: "start_monthly_billing" } — DRS "Build complete": sends the first
//   recurring invoice (due now). 200 = same body as GET (incl. billing);
//   409 { error } when the setup isn't paid / it was already sent / etc.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { engagementId } = await params;

  const engagement = await getOwnedEngagement(engagementId, session.user.id);
  if (!engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.action === "start_monthly_billing") {
    const result = await triggerDrsLaunchBilling(engagementId);
    if (!result.ok) {
      return NextResponse.json(
        { error: LAUNCH_BILLING_ERRORS[result.error] ?? "Couldn't start monthly billing." },
        { status: 409 }
      );
    }
    return buildAdminResponse(engagementId, session.user.id);
  }

  const state = getOnboardingState(engagement);
  if (!state) {
    return NextResponse.json({ error: "Onboarding not started" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const isoDate = (v: unknown): string | null =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  switch (body.action) {
    case "set_phase": {
      const phaseId = body.phaseId as PhaseId;
      if (!phaseIdsFor(state).includes(phaseId)) {
        return NextResponse.json(
          { error: "Invalid phase for this engagement" },
          { status: 400 }
        );
      }
      const current = state.phases[phaseId];
      const title = PHASE_INFO[phaseId].title;
      const entries: { segments: string[]; value: unknown }[] = [];
      let activityMessage: string | null = null;

      if (typeof body.status === "string") {
        const status = body.status;
        if (!["pending", "in_progress", "done"].includes(status)) {
          return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
        entries.push({ segments: ["phases", phaseId, "status"], value: status });
        if (status === "in_progress" && !current?.startedAt) {
          entries.push({ segments: ["phases", phaseId, "startedAt"], value: now });
        }
        if (status === "done") {
          entries.push({ segments: ["phases", phaseId, "completedAt"], value: now });
          activityMessage = `${title} is DONE ✅`;
        } else if (status === "in_progress" && current?.status !== "in_progress") {
          activityMessage = `${title} is now in the works ${PHASE_INFO[phaseId].emoji}`;
        }
      }
      if ("targetDate" in body) {
        entries.push({
          segments: ["phases", phaseId, "targetDate"],
          value: isoDate(body.targetDate),
        });
      }
      if ("note" in body) {
        const note = str(body.note, 500);
        entries.push({
          segments: ["phases", phaseId, "note"],
          value: note || null,
        });
      }
      await setOnboardingValues(engagementId, entries);
      if (activityMessage) {
        await appendActivity(engagementId, {
          actor: "agency",
          type: "phase_update",
          message: activityMessage,
        });
      }
      break;
    }

    case "set_launch_date": {
      await setOnboardingValues(engagementId, [
        { segments: ["targetLaunchDate"], value: isoDate(body.targetLaunchDate) },
      ]);
      break;
    }

    case "set_client_due_date": {
      const clientDueAt = isoDate(body.clientDueAt);
      await setOnboardingValues(engagementId, [
        { segments: ["clientDueAt"], value: clientDueAt },
      ]);
      await appendActivity(engagementId, {
        actor: "agency",
        type: "due_date_set",
        message: clientDueAt
          ? `Client items due date set to ${formatDueDate(clientDueAt)}`
          : "Client items due date cleared",
      });
      break;
    }

    case "set_campaign_launched": {
      // The day the ad campaigns went live — the Campaign progress tile
      // counts leads from this date (see lib/campaign-progress.ts). Null
      // clears it.
      const campaignLaunchedAt = isoDate(body.campaignLaunchedAt);
      await setOnboardingValues(engagementId, [
        { segments: ["campaignLaunchedAt"], value: campaignLaunchedAt },
      ]);
      await appendActivity(engagementId, {
        actor: "agency",
        type: "campaign_launched",
        message: campaignLaunchedAt
          ? `Campaigns went live on ${formatDueDate(campaignLaunchedAt)}`
          : "Campaign launch date cleared",
      });
      break;
    }

    case "review_task": {
      const taskId = body.taskId as TaskId;
      if (!taskIdsFor(state).includes(taskId)) {
        return NextResponse.json(
          { error: "Invalid task for this engagement" },
          { status: 400 }
        );
      }
      const status = body.status;
      if (status !== "approved" && status !== "needs_attention") {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const adminNote = str(body.adminNote, 500);
      if (!state.tasks[taskId]) {
        // Legacy onboardings may lack this task key; jsonb_set can't create
        // intermediate paths, so write the whole task object instead.
        await setOnboardingValues(engagementId, [
          {
            segments: ["tasks", taskId],
            value: {
              ...defaultTaskState(taskId),
              status,
              reviewedAt: now,
              adminNote: adminNote || null,
            },
          },
        ]);
      } else {
        await setOnboardingValues(engagementId, [
          { segments: ["tasks", taskId, "status"], value: status },
          { segments: ["tasks", taskId, "reviewedAt"], value: now },
          { segments: ["tasks", taskId, "adminNote"], value: adminNote || null },
        ]);
      }
      if (status === "approved") {
        await appendActivity(engagementId, {
          actor: "agency",
          type: "task_reviewed",
          message: `${TASK_INFO[taskId].title} — reviewed and approved ✅`,
        });
      }
      break;
    }

    case "post_update": {
      const message = str(body.message, 500);
      if (!message) {
        return NextResponse.json({ error: "Message required" }, { status: 400 });
      }
      await appendActivity(engagementId, {
        actor: "agency",
        type: "note",
        message,
      });
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return buildAdminResponse(engagementId, session.user.id);
}
