import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { emailWrapper, escapeHtml, sendEmailWithLog } from "@/lib/email";
import { adAnalyses, adSteps } from "@/lib/ads/tables";
import { getSettings } from "@/lib/ads/settings";
import type { ParsedAnalysis } from "@/lib/ads/parse";

/**
 * Ads alerts: a bell notification plus (unless turned off) an email to the
 * admin inbox. Every send is claimed first (notified_at / waiting key /
 * remind_sent_at), so the page, the poll and the cron can never double-send.
 * Everything Manus wrote is HTML-escaped.
 */

const ADMIN_EMAIL = "mail@nexli.net";
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net";

type Analysis = typeof adAnalyses.$inferSelect;

const PRIORITY_LABEL: Record<string, string> = { now: "Do now", this_week: "This week", next_week: "Next week", later: "Later" };
const VERDICT_LABEL: Record<string, string> = {
  too_early: "Too early to call",
  hold_steady: "Hold steady",
  optimize: "Optimize",
  refresh_creatives: "Refresh creatives",
  fix_tracking: "Fix tracking first",
  scale: "Scale",
  rethink: "Rethink",
};
export const verdictLabel = (v: string | null | undefined) => (v ? (VERDICT_LABEL[v] ?? v) : "—");

async function bell(userId: string, type: string, title: string, message: string, metadata: Record<string, unknown>) {
  await db.insert(notifications).values({ userId, type, title, message, metadata, read: false });
}

function button(href: string, label: string) {
  return `<div style="text-align:center;margin-top:20px;"><a href="${PORTAL_URL}${href}" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#06B6D4);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:700;">${escapeHtml(label)}</a></div>`;
}

async function email(subject: string, inner: string, emailType: string, relatedId: string) {
  await sendEmailWithLog({ to: ADMIN_EMAIL, subject, html: emailWrapper(inner), recipientName: "Nexli Admin", emailType, relatedId });
}

/** "Your ads analysis is ready" — once per analysis (research runs get their own alert). */
export async function notifyReady(row: Analysis): Promise<void> {
  if (row.kind === "research") return notifyResearchReady(row);
  const [claimed] = await db
    .update(adAnalyses)
    .set({ notifiedAt: new Date() })
    .where(and(eq(adAnalyses.id, row.id), isNull(adAnalyses.notifiedAt), eq(adAnalyses.status, "done")))
    .returning();
  if (!claimed) return;
  const result = claimed.result as ParsedAnalysis | null;
  const steps = await db.select().from(adSteps).where(eq(adSteps.analysisId, claimed.id)).orderBy(adSteps.idx);
  const top = steps.filter((s) => s.status === "open").slice(0, 3);
  const title = `Ads analysis: ${verdictLabel(claimed.verdict)}${claimed.healthScore !== null ? ` · ${claimed.healthScore}/100` : ""}`;
  const headline = claimed.headline ?? result?.headline ?? "";
  await bell(claimed.ownerId, "ads_analysis_ready", title, headline || "Manus finished the analysis.", { analysisId: claimed.id, href: "/dashboard/ads" });
  const settings = await getSettings(claimed.ownerId, claimed.accountId);
  if (!settings.notifyEmail) return;
  const list = top
    .map(
      (s) =>
        `<li style="margin:0 0 10px;"><span style="color:#67e8f9;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(PRIORITY_LABEL[s.priority] ?? s.priority)}</span><br/><strong style="color:#fff;">${escapeHtml(s.title)}</strong><br/><span style="color:#9999a8;">${escapeHtml(s.why.slice(0, 220))}</span></li>`
    )
    .join("");
  await email(
    title,
    `<h1 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:700;">${escapeHtml(verdictLabel(claimed.verdict))}${claimed.healthScore !== null ? ` · health ${claimed.healthScore}/100` : ""}</h1>
     <p style="margin:0 0 16px;color:#cfd2dc;font-size:14px;line-height:1.6;">${escapeHtml(headline)}</p>
     ${result?.summary ? `<p style="margin:0 0 16px;color:#9999a8;font-size:13px;line-height:1.6;">${escapeHtml(result.summary)}</p>` : ""}
     ${list ? `<p style="margin:0 0 8px;color:#fff;font-size:13px;font-weight:700;">Next steps</p><ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;">${list}</ol>` : ""}
     ${button("/dashboard/ads#next-steps", "Open the Ads Command Center")}`,
    "ads_analysis_ready",
    claimed.id
  );
}

/** Manus is waiting on Marcel (a question it asked twice, or an action to approve) — once per question. */
export async function notifyNeedsInput(row: Analysis): Promise<void> {
  const waiting = row.waiting;
  if (!waiting) return;
  const [claimed] = await db
    .update(adAnalyses)
    .set({ waitingNotifiedKey: waiting.key })
    .where(and(eq(adAnalyses.id, row.id), eq(adAnalyses.status, "waiting"), sql`${adAnalyses.waitingNotifiedKey} IS DISTINCT FROM ${waiting.key}`))
    .returning({ id: adAnalyses.id });
  if (!claimed) return;
  const what = row.kind === "research" ? "the Ad Library research" : "the ads analysis";
  const href = row.kind === "research" ? "/dashboard/ads#research" : "/dashboard/ads";
  const title = waiting.kind === "confirm" ? `Manus wants your OK on ${what}` : `Manus has a question about ${what}`;
  await bell(row.ownerId, "ads_needs_input", title, waiting.prompt.slice(0, 300), { analysisId: row.id, href });
  const settings = await getSettings(row.ownerId, row.accountId);
  if (!settings.notifyEmail) return;
  await email(
    title,
    `<h1 style="margin:0 0 8px;color:#fff;font-size:18px;font-weight:700;">${escapeHtml(title)}</h1><p style="margin:0;color:#cfd2dc;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(waiting.prompt.slice(0, 1500))}</p>${button(href, "Answer in the Ads Command Center")}`,
    "ads_needs_input",
    row.id
  );
}

/** Steps whose check-back date has come — one digest, each step once. */
export async function notifyCheckBacks(ownerId: string, accountId: string): Promise<number> {
  const due = await db
    .select({ id: adSteps.id })
    .from(adSteps)
    .where(
      and(
        eq(adSteps.ownerId, ownerId),
        eq(adSteps.accountId, accountId),
        inArray(adSteps.status, ["open", "done"]),
        lte(adSteps.checkBackAt, new Date()),
        isNull(adSteps.checkedAt),
        isNull(adSteps.remindSentAt)
      )
    )
    .limit(20);
  if (!due.length) return 0;
  const claimed = await db
    .update(adSteps)
    .set({ remindSentAt: new Date() })
    .where(and(inArray(adSteps.id, due.map((d) => d.id)), isNull(adSteps.remindSentAt)))
    .returning();
  if (!claimed.length) return 0;
  const title = claimed.length === 1 ? `Time to check: ${claimed[0].title}` : `${claimed.length} ad steps are due a check`;
  await bell(ownerId, "ads_check_back", title, claimed.map((s) => s.title).join(" · ").slice(0, 300), { href: "/dashboard/ads#next-steps" });
  const settings = await getSettings(ownerId, accountId);
  if (settings.notifyEmail) {
    const list = claimed
      .map((s) => {
        const sc = s.successCheck as { targetDisplay?: string } | null;
        return `<li style="margin:0 0 10px;"><strong style="color:#fff;">${escapeHtml(s.title)}</strong>${sc?.targetDisplay ? `<br/><span style="color:#9999a8;">Look for: ${escapeHtml(sc.targetDisplay)}</span>` : ""}</li>`;
      })
      .join("");
    await email(
      title,
      `<h1 style="margin:0 0 8px;color:#fff;font-size:18px;font-weight:700;">Check-back time</h1><p style="margin:0 0 12px;color:#cfd2dc;font-size:14px;">Manus asked you to look at these again today:</p><ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;">${list}</ol>${button("/dashboard/ads#next-steps", "Open the next steps")}`,
      "ads_check_back",
      claimed[0].id
    );
  }
  return claimed.length;
}

/** "Ad Library research is ready" — once per run. No screenshots in the email (they stay private). */
export async function notifyResearchReady(row: Analysis): Promise<void> {
  const [claimed] = await db
    .update(adAnalyses)
    .set({ notifiedAt: new Date() })
    .where(and(eq(adAnalyses.id, row.id), isNull(adAnalyses.notifiedAt), eq(adAnalyses.status, "done")))
    .returning();
  if (!claimed) return;
  const r = (claimed.result ?? {}) as {
    summary?: string;
    ads?: unknown[];
    briefs?: { title?: string; format?: string; count?: number }[];
    marketPatterns?: { title?: string; detail?: string }[];
  };
  const ads = r.ads?.length ?? 0;
  const briefs = r.briefs ?? [];
  const title = `Ad Library research: ${ads} ad${ads === 1 ? "" : "s"}, ${briefs.length} brief${briefs.length === 1 ? "" : "s"}`;
  const headline = claimed.headline ?? "";
  await bell(claimed.ownerId, "ads_research_ready", title, headline || "Manus finished the Ad Library research.", { analysisId: claimed.id, href: "/dashboard/ads#research" });
  const settings = await getSettings(claimed.ownerId, claimed.accountId);
  if (!settings.notifyEmail) return;
  const patterns = (r.marketPatterns ?? [])
    .slice(0, 3)
    .map((p) => `<li style="margin:0 0 8px;"><strong style="color:#fff;">${escapeHtml(p.title ?? "")}</strong><br/><span style="color:#9999a8;">${escapeHtml((p.detail ?? "").slice(0, 220))}</span></li>`)
    .join("");
  const list = briefs
    .slice(0, 8)
    .map((b) => `<li style="margin:0 0 6px;color:#cfd2dc;">${escapeHtml(b.title ?? "")} <span style="color:#9999a8;">· ${escapeHtml(String(b.count ?? ""))} ${b.format === "video" ? "videos" : "photo ads"}</span></li>`)
    .join("");
  await email(
    title,
    `<h1 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:700;">${escapeHtml(headline || "Ad Library research is ready")}</h1>
     ${r.summary ? `<p style="margin:0 0 16px;color:#9999a8;font-size:13px;line-height:1.6;">${escapeHtml(r.summary)}</p>` : ""}
     ${patterns ? `<p style="margin:0 0 8px;color:#fff;font-size:13px;font-weight:700;">What's working in the market</p><ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.5;">${patterns}</ul>` : ""}
     ${list ? `<p style="margin:0 0 8px;color:#fff;font-size:13px;font-weight:700;">Creatives to make next</p><ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;">${list}</ol>` : ""}
     ${button("/dashboard/ads#research", "Open the research")}`,
    "ads_research_ready",
    claimed.id
  );
}
