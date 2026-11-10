import { NextRequest, NextResponse } from "next/server";
import {
  getOnboardingBySignerToken,
  serializePublicOnboarding,
  setOnboardingValues,
  appendActivity,
  defaultTaskState,
  tasksOf,
  TASK_INFO,
  type TaskId,
} from "@/lib/onboarding";
import { encryptSubmission } from "@/lib/onboarding-crypto";
import { cleanPaymentSetup, processorName } from "@/lib/payment-setup";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { getNexliAdminId } from "@/lib/foundation-project";

// Public Launch Pad API. The signer token in the URL is the credential.
// serializePublicOnboarding is the security boundary: credential
// submissions and file storage paths are never echoed back.

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

// GET — load onboarding state for this signer's engagement
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ctx = await getOnboardingBySignerToken(token);
  if (!ctx) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!ctx.onboarding) {
    return NextResponse.json({ error: "not_started" }, { status: 409 });
  }

  // Nexli's own engagements show Nexli's legal identity + nexli.net policies
  // in the footer; a firm's own onboarding never does.
  const nexliAdminId = await getNexliAdminId();

  return NextResponse.json({
    clientName: ctx.signer.name,
    subject: ctx.engagement.subject,
    signedAt: ctx.signer.signedAt,
    from: {
      name: ctx.owner?.name || "",
      company: ctx.owner?.companyName || "",
    },
    nexli: Boolean(nexliAdminId) && ctx.engagement.ownerId === nexliAdminId,
    onboarding: serializePublicOnboarding(ctx.onboarding),
  });
}

// POST — client submits a task ({ taskId, submission })
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rate = checkRateLimit(`onboarding:${token}`, 15, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const ctx = await getOnboardingBySignerToken(token);
  if (!ctx) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!ctx.onboarding) {
    return NextResponse.json({ error: "not_started" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const taskId = body.taskId as TaskId;
  // drivers_license goes through the /upload route, not JSON submissions.
  // stripe_setup is gone (Nov 2026): payment_setup asked instead.
  if (
    taskId !== "dns_access" &&
    taskId !== "fb_ads_invite" &&
    taskId !== "payment_setup"
  ) {
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }

  const current = tasksOf(ctx.onboarding)[taskId];
  if (current?.status === "approved") {
    return NextResponse.json(
      { error: "This item has already been approved." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  let activityMessage: string;
  let submissionValue: unknown;

  if (taskId === "dns_access") {
    const raw = (body.submission || {}) as Record<string, unknown>;
    const submission = {
      registrar: str(raw.registrar, 200),
      loginUrl: str(raw.loginUrl, 500),
      username: str(raw.username, 500),
      password: str(raw.password, 500),
      notes: str(raw.notes, 2000),
      submittedIp: getClientIp(req),
      submittedAt: now,
    };
    if (!submission.registrar || !submission.username || !submission.password) {
      return NextResponse.json(
        { error: "Registrar, username, and password are required." },
        { status: 400 }
      );
    }
    submissionValue = encryptSubmission(submission);
    activityMessage = `${ctx.signer.name} sent over their domain & DNS access 🌐`;
  } else if (taskId === "payment_setup") {
    // Who processes their payments + which amounts go by card / ACH / wire.
    // No secrets, so it's stored as-is (the client sees their answers back).
    const cleaned = cleanPaymentSetup(body.submission);
    if (!cleaned.ok) {
      return NextResponse.json({ error: cleaned.error }, { status: 400 });
    }
    submissionValue = { ...cleaned.value, submittedAt: now };
    activityMessage = `${ctx.signer.name} told us how they get paid (${processorName(cleaned.value)}) 💳`;
  } else {
    const raw = (body.submission || {}) as Record<string, unknown>;
    const submission = raw.notApplicable
      ? { notApplicable: true }
      : { confirmed: true };
    submissionValue = submission;
    activityMessage = submission.notApplicable
      ? `${ctx.signer.name} doesn't run Facebook Ads — item skipped`
      : `${ctx.signer.name} sent the Facebook Ads partner invite 📣`;
  }

  if (!ctx.onboarding.tasks[taskId]) {
    // Onboardings created before this task existed lack the tasks.<id> key,
    // and jsonb_set can't create intermediate path elements — so write the
    // whole task object in one shot (parent "tasks" always exists).
    await setOnboardingValues(ctx.engagement.id, [
      {
        segments: ["tasks", taskId],
        value: {
          ...defaultTaskState(taskId),
          status: "submitted",
          submittedAt: now,
          submission: submissionValue,
        },
      },
    ]);
  } else {
    // One atomic UPDATE for submission + status + timestamp
    await setOnboardingValues(ctx.engagement.id, [
      { segments: ["tasks", taskId, "submission"], value: submissionValue },
      { segments: ["tasks", taskId, "status"], value: "submitted" },
      { segments: ["tasks", taskId, "submittedAt"], value: now },
    ]);
  }
  await appendActivity(ctx.engagement.id, {
    actor: "client",
    type: "task_submitted",
    message: activityMessage,
  });

  try {
    await createNotification({
      userId: ctx.engagement.ownerId,
      type: "onboarding_task_submitted",
      title: "Onboarding Item Submitted",
      message: `${ctx.signer.name} completed "${TASK_INFO[taskId].title}"`,
      metadata: { engagementId: ctx.engagement.id, taskId },
    });
  } catch (err) {
    console.error("Onboarding notification failed:", err);
  }

  return NextResponse.json({ ok: true, status: "submitted", submittedAt: now });
}
