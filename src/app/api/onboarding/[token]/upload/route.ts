import { NextRequest, NextResponse } from "next/server";
import {
  getOnboardingBySignerToken,
  setOnboardingValues,
  appendActivity,
  type LicenseFileMeta,
  type LicenseSide,
} from "@/lib/onboarding";
import { getSupabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

// POST — upload one side of the driver's license (multipart: side, file)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rate = checkRateLimit(`onboarding-upload:${token}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment." },
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

  const task = ctx.onboarding.tasks.drivers_license;
  if (task?.status === "approved") {
    return NextResponse.json(
      { error: "This item has already been approved." },
      { status: 409 }
    );
  }

  const formData = await req.formData();
  const side = formData.get("side") as LicenseSide;
  const file = formData.get("file") as File | null;

  if (side !== "front" && side !== "back") {
    return NextResponse.json({ error: "Invalid side" }, { status: 400 });
  }
  if (!file || !file.size) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File exceeds the 10MB limit." },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "Please upload a photo (JPG, PNG, HEIC) or PDF." },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const storagePath = `documents/${ctx.engagement.ownerId}/onboarding/${ctx.engagement.id}/license_${side}_${crypto.randomUUID()}_${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await getSupabase()
    .storage.from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[Onboarding upload] Supabase error:", uploadError);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();
  const meta: LicenseFileMeta = {
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    uploadedAt: now,
  };

  // One atomic write per side — concurrent front/back uploads can't clobber
  // each other. A re-upload before approval simply replaces the side.
  // RETURNING reads back the files object in the same statement, so we see
  // whether the other side is already in.
  const files = (await setOnboardingValues(
    ctx.engagement.id,
    [
      {
        segments: ["tasks", "drivers_license", "submission", "files", side],
        value: meta,
      },
    ],
    ["tasks", "drivers_license", "submission", "files"]
  )) as Record<string, LicenseFileMeta | null> | null;
  const bothIn = Boolean(files?.front && files?.back);

  if (bothIn && task?.status !== "submitted") {
    await setOnboardingValues(ctx.engagement.id, [
      { segments: ["tasks", "drivers_license", "status"], value: "submitted" },
      { segments: ["tasks", "drivers_license", "submittedAt"], value: now },
    ]);
    await appendActivity(ctx.engagement.id, {
      actor: "client",
      type: "task_submitted",
      message: `${ctx.signer.name} uploaded their driver's license for A2P verification 🪪`,
    });
    try {
      await createNotification({
        userId: ctx.engagement.ownerId,
        type: "onboarding_task_submitted",
        title: "Onboarding Item Submitted",
        message: `${ctx.signer.name} uploaded their driver's license (front & back)`,
        metadata: { engagementId: ctx.engagement.id, taskId: "drivers_license" },
      });
    } catch (err) {
      console.error("Onboarding notification failed:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    side,
    fileName: file.name,
    bothSidesIn: bothIn,
    status: bothIn ? "submitted" : task?.status ?? "todo",
  });
}
