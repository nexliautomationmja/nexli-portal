import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getContacts } from "@/lib/ghl-client";

/**
 * Connection diagnostic for GoHighLevel. Runs the real contacts call
 * server-side with the configured key + the user's saved Location ID and
 * reports exactly what failed in plain English. Never returns the key.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.GHL_API_KEY || "";
  const keyPresent = key.length > 0;
  const keyShape = !keyPresent
    ? "missing"
    : key.startsWith("pit-")
      ? "pit"
      : key.startsWith("eyJ")
        ? "jwt"
        : "other";

  const [user] = await db
    .select({ ghlLocationId: users.ghlLocationId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const locationId = user?.ghlLocationId || null;

  if (!keyPresent) {
    return NextResponse.json({
      ok: false,
      keyShape,
      locationId,
      message:
        "No GHL_API_KEY is set in this deployment's environment. Add it in Vercel → Settings → Environment Variables (Production) and redeploy.",
    });
  }
  if (keyShape === "jwt") {
    return NextResponse.json({
      ok: false,
      keyShape,
      locationId,
      message:
        "The configured key looks like a classic API key (starts with eyJ). The portal uses GHL's v2 API, which needs a Private Integration token starting with pit-.",
    });
  }
  if (!locationId) {
    return NextResponse.json({
      ok: false,
      keyShape,
      locationId,
      message: "No Location ID is saved yet. Enter it above and hit Connect first.",
    });
  }

  try {
    const res = await getContacts(locationId, 1);
    return NextResponse.json({
      ok: true,
      keyShape,
      locationId,
      contactsTotal: res.total ?? null,
      message: `Connected! GoHighLevel reports ${res.total ?? "?"} contacts in this location.`,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    let hint = "GoHighLevel rejected the request.";
    if (raw.includes(" 401 ")) {
      hint =
        "GoHighLevel says the token is invalid (401). The pit- token in Vercel may be revoked, pasted with extra spaces, or the redeploy didn't pick it up.";
    } else if (raw.includes(" 403 ")) {
      hint =
        "The token works but lacks permission (403). Edit the Private Integration in GHL and enable the View Contacts / Opportunities / Calendars / Conversations scopes.";
    } else if (raw.includes(" 404 ") || raw.includes(" 422 ")) {
      hint =
        "The token can't see this Location ID (404/422). The Private Integration was likely created in a different sub-account than this Location ID, or the ID has a typo.";
    }
    return NextResponse.json({
      ok: false,
      keyShape,
      locationId,
      message: hint,
      detail: raw.slice(0, 600),
    });
  }
}
