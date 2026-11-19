import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  PerformanceError,
  addExtra,
  clearCancellation,
  performanceContextFor,
  performanceView,
  recordCancellation,
  removeExtra,
  reopenStatement,
  sendStatement,
  setAdSpend,
  setClientRule,
} from "@/lib/performance/service";

// Reading the client's CRM and Meta can take a while on a first load.
export const maxDuration = 120;

/**
 * Performance Pay for one client firm on the Nov 19 2026 pricing (admin
 * only: this reads another tenant's leads and invoices).
 *
 * GET            → the panel: this month so far, the months that have ended,
 *                  the ad-sourced clients with their trail. ?sync=1 re-reads
 *                  the client's CRM first.
 * POST {action}  → one change, then the fresh panel:
 *   sync
 *   set_spend          { month, dollars | null }
 *   add_extra          { month, name, dollars, at?, note? }
 *   remove_extra       { month, id }
 *   rule               { email, rule: "include" | "exclude" | null, leadId?, reason? }
 *   send               { month }   — freezes the month; invoices it when something is due
 *   reopen             { month }   — a "nothing due" month back to a draft
 *   record_cancellation { noticeDate: "YYYY-MM-DD" }
 *   clear_cancellation
 */

type Ctx = { params: Promise<{ clientId: string }> };

async function adminId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session.user.id;
}

const cents = (dollars: unknown): number | null => {
  const n = typeof dollars === "number" ? dollars : typeof dollars === "string" ? Number(dollars.replace(/[$,\s]/g, "")) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await adminId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId } = await params;
  try {
    return NextResponse.json(await performanceView(clientId, { sync: req.nextUrl.searchParams.get("sync") === "1" }));
  } catch (err) {
    console.error("[performance] view failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't load performance pay." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const actorId = await adminId();
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const month = typeof body?.month === "number" ? body.month : NaN;

  try {
    const ctx = await performanceContextFor(clientId);
    if (!ctx) return NextResponse.json({ error: "This client isn't on the performance pricing." }, { status: 404 });
    let note: string | undefined;

    switch (action) {
      case "sync":
        return NextResponse.json(await performanceView(clientId, { sync: true }));
      case "set_spend": {
        const value = body?.dollars === null || body?.dollars === "" ? null : cents(body?.dollars);
        if (body?.dollars !== null && body?.dollars !== "" && value === null) throw new PerformanceError("Enter the ad spend as a dollar amount.");
        await setAdSpend(ctx, month, value);
        break;
      }
      case "add_extra": {
        const amount = cents(body?.dollars);
        if (amount === null) throw new PerformanceError("Enter the amount as dollars.");
        await addExtra(ctx, month, {
          name: typeof body?.name === "string" ? body.name : "",
          amountCents: amount,
          at: typeof body?.at === "string" ? body.at : null,
          note: typeof body?.note === "string" ? body.note : null,
        });
        break;
      }
      case "remove_extra":
        await removeExtra(ctx, month, typeof body?.id === "string" ? body.id : "");
        break;
      case "rule": {
        const rule = body?.rule === "include" || body?.rule === "exclude" ? body.rule : null;
        await setClientRule(ctx, {
          email: typeof body?.email === "string" ? body.email : "",
          rule,
          leadId: typeof body?.leadId === "string" ? body.leadId : null,
          reason: typeof body?.reason === "string" ? body.reason : null,
          actorId,
        });
        break;
      }
      case "send": {
        const result = await sendStatement(ctx, month);
        note = result.status === "sent" ? "Invoice sent." : "Closed with nothing due. No invoice was sent.";
        break;
      }
      case "reopen":
        await reopenStatement(ctx, month);
        break;
      case "record_cancellation": {
        const raw = typeof body?.noticeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.noticeDate) ? body.noticeDate : "";
        if (!raw) throw new PerformanceError("Enter the date their notice arrived.");
        // Noon UTC, so the calendar day he typed is the day that counts in any US time zone.
        const result = await recordCancellation(ctx, new Date(`${raw}T12:00:00.000Z`));
        note =
          result.autopay === "failed"
            ? "Recorded, but Stripe wouldn't set the end date on their autopay. End the subscription in Stripe on that date."
            : result.autopay === "stopped"
              ? "Recorded. Their autopay stops on that date."
              : "Recorded.";
        break;
      }
      case "clear_cancellation": {
        const result = await clearCancellation(ctx);
        note = result.autopay === "failed" ? "Removed, but Stripe still has an end date on their autopay. Clear it in Stripe." : "Removed. The agreement renews as before.";
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ...(await performanceView(clientId)), note });
  } catch (err) {
    if (err instanceof PerformanceError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[performance] action failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "That didn't go through. Try again." }, { status: 500 });
  }
}
