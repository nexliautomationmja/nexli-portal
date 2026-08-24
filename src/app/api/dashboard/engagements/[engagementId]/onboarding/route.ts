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
  PHASE_ORDER,
  PHASE_INFO,
  TASK_ORDER,
  TASK_INFO,
  type OnboardingState,
  type PhaseId,
  type TaskId,
  type LicenseFileMeta,
} from "@/lib/onboarding";
import { getSupabase } from "@/lib/supabase";

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
    return NextResponse.json({ error: "Onboarding not started" }, { status: 404 });
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

  await initOnboarding(engagementId, "admin");
  return buildAdminResponse(engagementId, session.user.id);
}

// PATCH — { action, ... } dispatch, each a targeted jsonb write
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
  const state = getOnboardingState(engagement);
  if (!state) {
    return NextResponse.json({ error: "Onboarding not started" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const isoDate = (v: unknown): string | null =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  switch (body.action) {
    case "set_phase": {
      const phaseId = body.phaseId as PhaseId;
      if (!PHASE_ORDER.includes(phaseId)) {
        return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
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

    case "review_task": {
      const taskId = body.taskId as TaskId;
      if (!TASK_ORDER.includes(taskId)) {
        return NextResponse.json({ error: "Invalid task" }, { status: 400 });
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
