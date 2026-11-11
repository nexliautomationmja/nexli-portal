import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { createUploadTarget } from "@/lib/creative-studio/storage";
import { styleRefPrefix } from "@/lib/creative-studio/photo-ads-service";

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Upload a reference ad to mimic (before planning a photo ad batch).
 * POST { mime } → a one-time upload target; the path then goes in the plan request.
 */
export async function POST(req: NextRequest) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => null)) as { mime?: unknown } | null;
  const ext = typeof body?.mime === "string" ? IMAGE_TYPES[body.mime] : undefined;
  if (!ext) return NextResponse.json({ error: "Use a PNG, JPG or WebP image" }, { status: 400 });
  return NextResponse.json(await createUploadTarget(`${styleRefPrefix(access.ownerId)}${randomUUID()}.${ext}`));
}
