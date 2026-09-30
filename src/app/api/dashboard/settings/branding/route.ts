import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSupabase } from "@/lib/supabase";
import { sanitizeHexColor } from "@/lib/branding";

const BUCKET = "brand-assets";
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_DISPLAY_NAME = 80;

const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/jpeg": "jpg",
};

/** GET — current branding fields for the signed-in firm. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      portalDisplayName: users.portalDisplayName,
      logoUrl: users.logoUrl,
      brandColor: users.brandColor,
      companyName: users.companyName,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    portalDisplayName: user.portalDisplayName ?? "",
    logoUrl: user.logoUrl ?? null,
    brandColor: user.brandColor ?? "",
    // What the portal will show if no display name is set.
    fallbackDisplayName: user.companyName || user.name || "Your Firm",
  });
}

/**
 * POST (multipart) — update display name, brand color and optionally upload a
 * new logo. Fields: portalDisplayName, brandColor, logo (file, optional).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = session.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  // ── Display name ──
  const rawName = form.get("portalDisplayName");
  const portalDisplayName =
    typeof rawName === "string" ? rawName.trim().slice(0, MAX_DISPLAY_NAME) : "";

  // ── Brand color (empty clears it) ──
  const rawColor = form.get("brandColor");
  const colorInput = typeof rawColor === "string" ? rawColor.trim() : "";
  let brandColor: string | null = null;
  if (colorInput) {
    brandColor = sanitizeHexColor(colorInput);
    if (!brandColor) {
      return NextResponse.json(
        { error: "Brand color must be a hex value like #0f766e" },
        { status: 400 }
      );
    }
  }

  // ── Logo upload (optional) ──
  let logoUrl: string | undefined;
  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const ext = ALLOWED_LOGO_TYPES[logo.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Logo must be a PNG, SVG or JPEG image" },
        { status: 400 }
      );
    }
    if (logo.size > MAX_LOGO_BYTES) {
      return NextResponse.json(
        { error: "Logo must be 2MB or smaller" },
        { status: 400 }
      );
    }

    const path = `branding/${ownerId}/logo.${ext}`;
    const buffer = Buffer.from(await logo.arrayBuffer());
    const supabase = getSupabase();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: logo.type,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[branding] logo upload failed:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload logo. Please try again." },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // Cache-bust so a re-uploaded logo at the same path shows immediately.
    logoUrl = `${data.publicUrl}?v=${Date.now()}`;
  }

  const [updated] = await db
    .update(users)
    .set({
      portalDisplayName: portalDisplayName || null,
      brandColor,
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, ownerId))
    .returning({
      portalDisplayName: users.portalDisplayName,
      logoUrl: users.logoUrl,
      brandColor: users.brandColor,
    });

  return NextResponse.json({
    ok: true,
    portalDisplayName: updated?.portalDisplayName ?? "",
    logoUrl: updated?.logoUrl ?? null,
    brandColor: updated?.brandColor ?? "",
  });
}
