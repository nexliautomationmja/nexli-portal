import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, analyticsSnapshots } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  getContacts,
  getPipelines,
  getCalendars,
  searchConversations,
} from "@/lib/ghl-client";

/**
 * Connection diagnostic for GoHighLevel. Runs each API family the portal
 * uses with the configured key + the user's saved Location ID and reports
 * per-endpoint results, so a missing scope is named individually. On a
 * successful contacts check it busts the analytics caches so the dashboard
 * shows fresh numbers immediately. Never returns the key.
 */

interface CheckResult {
  name: string;
  ok: boolean;
  info: string;
}

function statusHint(raw: string, scope: string): string {
  if (raw.includes(" 401 ")) {
    return "Token rejected (401) — the pit- token may be revoked, pasted with spaces, or the redeploy didn't pick it up.";
  }
  if (raw.includes(" 403 ")) {
    return `Missing permission (403) — enable the ${scope} scope on the Private Integration in GHL.`;
  }
  if (raw.includes(" 404 ") || raw.includes(" 422 ")) {
    return "Location mismatch (404/422) — the token was created in a different sub-account than this Location ID, or the ID has a typo.";
  }
  return `Request failed: ${raw.slice(0, 200)}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.GHL_API_KEY || "";
  const keyShape = !key
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

  if (!key) {
    return NextResponse.json({
      ok: false,
      keyShape,
      locationId,
      message:
        "No GHL_API_KEY is set in this deployment's environment. Add it in Vercel → Settings → Environment Variables (Production) and redeploy.",
      checks: [],
    });
  }
  if (keyShape === "jwt") {
    return NextResponse.json({
      ok: false,
      keyShape,
      locationId,
      message:
        "The configured key looks like a classic API key (starts with eyJ). The portal uses GHL's v2 API, which needs a Private Integration token starting with pit-.",
      checks: [],
    });
  }
  if (!locationId) {
    return NextResponse.json({
      ok: false,
      keyShape,
      locationId,
      message: "No Location ID is saved yet. Enter it above and hit Connect first.",
      checks: [],
    });
  }

  const checks: CheckResult[] = [];
  let contactsOk = false;

  // Contacts — drives the dashboard Contacts card and recent leads.
  try {
    const res = await getContacts(locationId, 1);
    const exact = res.count ?? res.total;
    contactsOk = true;
    checks.push({
      name: "Contacts",
      ok: true,
      info:
        exact != null
          ? `${exact.toLocaleString("en-US")} contacts in this location`
          : "connected (GHL did not report a total count)",
    });
  } catch (err) {
    checks.push({
      name: "Contacts",
      ok: false,
      info: statusHint(err instanceof Error ? err.message : String(err), "View Contacts"),
    });
  }

  // Pipelines/opportunities — pipeline data.
  try {
    const res = await getPipelines(locationId);
    checks.push({
      name: "Pipelines",
      ok: true,
      info: `${res.pipelines?.length ?? 0} pipeline(s) found`,
    });
  } catch (err) {
    checks.push({
      name: "Pipelines",
      ok: false,
      info: statusHint(err instanceof Error ? err.message : String(err), "View Opportunities"),
    });
  }

  // Calendars — bookings for the conversion funnel.
  try {
    const res = await getCalendars(locationId);
    checks.push({
      name: "Calendars",
      ok: true,
      info: `${res.calendars?.length ?? 0} calendar(s) found (events also need the separate "View Calendar Events" scope)`,
    });
  } catch (err) {
    checks.push({
      name: "Calendars",
      ok: false,
      info: statusHint(err instanceof Error ? err.message : String(err), "View Calendars"),
    });
  }

  // Conversations — response/speed-to-lead metrics.
  try {
    const res = await searchConversations(locationId, 1);
    checks.push({
      name: "Conversations",
      ok: true,
      info: `${(res.total ?? 0).toLocaleString("en-US")} conversation(s) found`,
    });
  } catch (err) {
    checks.push({
      name: "Conversations",
      ok: false,
      info: statusHint(err instanceof Error ? err.message : String(err), "View Conversations"),
    });
  }

  // Bust the analytics caches on success so the dashboard reflects reality
  // immediately instead of serving a stale zero snapshot for up to 4 hours.
  if (contactsOk) {
    try {
      await db
        .delete(analyticsSnapshots)
        .where(
          and(
            eq(analyticsSnapshots.userId, session.user.id),
            inArray(analyticsSnapshots.source, ["gohighlevel", "ghl-metrics"])
          )
        );
    } catch (err) {
      console.error("GHL cache bust failed:", err);
    }
  }

  const failed = checks.filter((c) => !c.ok);
  return NextResponse.json({
    ok: contactsOk,
    keyShape,
    locationId,
    checks,
    message: contactsOk
      ? failed.length === 0
        ? "Connected! All GoHighLevel checks passed — refresh your dashboard."
        : `Contacts are flowing — ${failed.map((c) => c.name).join(", ")} still need attention (see below).`
      : "GoHighLevel rejected the contacts request — see the checklist below.",
  });
}
