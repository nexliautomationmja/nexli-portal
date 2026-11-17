import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adChats } from "@/lib/ads/tables";
import { getSettings, type AdSettingsRow } from "@/lib/ads/settings";
import { metricsPack, snapshot30 } from "@/lib/ads/pack";
import { buildAdsSnapshot } from "@/lib/ads/snapshot";
import { decideAds, type AdPlan, type CreativeCall } from "@/lib/ads/decide";
import { latestPlan, planDateFor } from "@/lib/ads/daily-plan";
import { loadTrackingData } from "@/lib/ads/tracking-data";
import { trackingVerdict } from "@/lib/ads/tracking-check";
import { bounds, buildAttribution, ghlLocationOf, loadLeads, type CompactLead } from "@/lib/ads/attribution";
import { addDays, localDate, rangeWindows } from "@/lib/ads/time";
import { goalsOf, listChanges, proposeChange } from "@/lib/ads/corrections";
import { dayLabel, type CallOverridePayload, type ChangeView, type GoalsPayload, type GoalsValues, type LeadFixPayload } from "@/lib/ads/corrections-shared";
import { CHAT_MAX_USER_TURNS, type ChatBlock, type ChatEvent, type ChatView, type CreativeCardData, type DisplayItem, type DisplayTurn, type LeadRowData, type WindowNumbers, addText } from "@/lib/ads/chat-shared";
import { decimal, money, pct } from "@/lib/ads/format";
import { getContactById } from "@/lib/ghl-client";
import { parseAdsRange, type AdRow, type AdsSnapshot, type Metrics } from "@/lib/ads/types";

/**
 * The Ask chat on the Ads page: Marcel asks about his numbers in plain words;
 * Claude answers from the same numbers the page shows (a brief of the account
 * up front, tools for the details) and can PROPOSE changes — a lead or booked
 * call that didn't really happen, his own Cut / Keep on a creative, new
 * goals. Nothing changes until Marcel taps Apply on the card. Portal only:
 * Meta is never changed from here.
 *
 * The model's history is append-only (saved exactly as returned, thinking
 * included); the account brief rides in front of each of Marcel's messages,
 * so the system prompt never changes inside a chat.
 */

const MODEL = "claude-opus-5-5";
const MAX_ROUNDS = 8;
const TURN_BUDGET_MS = 270_000;
const RESULT_MAX = 14_000;

type ChatRow = typeof adChats.$inferSelect;
type Msg = { role: "user" | "assistant"; content: unknown[] | string };
type Block = { type: string; [k: string]: unknown };

const SYSTEM = `You are the ad analyst inside Nexli's Ads Command Center, talking with Marcel, who owns Nexli. Nexli sells the Digital Rainmaker System (done-for-you client acquisition: website, funnel, Meta ads, CRM, automations) to owners of US CPA and accounting firms. Every ad has one job: get the right firm owner to book a free strategy call. Booked calls matter most, then leads.

WHAT YOU KNOW
- Each of Marcel's messages starts with <account_now>: the latest numbers and today's Cut / Keep call on every live creative. The newest one is the truth; if it says the numbers are unchanged, use the last full one.
- Tools give you the details: a creative's numbers by window, the CRM leads credited to it, the account's numbers for 7/14/30/90 days, and the Meta-vs-CRM tracking check.
- Only use numbers from <account_now> or your tools. If you don't have something, say so — never guess a number.

HOW THE NUMBERS WORK
- Leads and booked calls come from GoHighLevel (the CRM). A lead is credited to an ad when its utm_content is that ad's name or id (if several ads share a name, the one that spent most gets it — a best guess). A lead counts as booked when it has a booked-call tag or the pipeline shows a booked call.
- If an ad has no utm_content, the CRM can't credit it: the plan then uses Meta's own lead count and can't see booked calls for it.
- Meta's lead count can include things that never reached the CRM (test submissions, duplicates, pixel events). The CRM is the truth for the plan.
- Marcel's corrections (a lead or booked call he marked as not real) are already left out of every number you see.

THE DAILY CUT / KEEP RULES (30-day numbers; T = target cost per booked call, L = target cost per lead)
- CUT: spent 2T with no booked call (5+ days old) · spent 3L with no lead (3+ days old) · booked calls cost 2T+ after 3T spent · under 0.4% clicked on 3,000+ views in 7 days · worn out and not a winner.
- KEEP: Winner (2+ booked calls at or under T) · Working (booked calls, or leads when booked calls can't be seen) · Testing (not enough spend to judge yet — it shows the spend where it gets decided) · Tiring (still producing, wearing out).
- Marcel's own call ("· yours") wins until its date, then the rules decide again.

WHAT YOU CAN CHANGE — ONLY BY PROPOSING
- You never change anything yourself. The propose_ tools put a card in the chat; nothing happens until Marcel taps Apply. Never say a change is made — say what the card will do and that he can tap Apply. He can undo anything he applied.
- Remove a lead or a booked call that didn't really happen: first call credited_leads, find the exact contact, and show which one. If you can't tell which lead he means, ask before proposing.
- Marcel's own Cut / Keep on a live creative, for 1–30 days (7 by default), with his reason.
- New targets or a standing note (Goals).
- For an ad counted from Meta's numbers (no utm_content), you can't remove a single Meta lead: explain that, propose his own Cut / Keep call instead, and tell him to add utm_content={{ad.name}} to the ad's URL parameters.
- You can't touch Meta. Turning ads off or on and budgets are done by Marcel in Ads Manager (each creative card links there).
- Propose only what he asked for or what clearly fixes the problem he raised; one card per change.

HOW TO ANSWER
- Lead with the answer (cut it / keep it / the number is wrong because…), then the why with the key numbers. Plain words, no jargon, no emojis. Usually under 180 words; more only when he asks for detail.
- Money as $1,234. Use a short markdown table only when comparing several creatives.
- Cards from your tools appear in the chat on their own, so don't repeat every number on them — point out what matters.`;

// ── Tools ─────────────────────────────────────────────────

const adParam = { type: "string", description: "The ad's id, or its name (or a clear part of it) as shown in account_now." };

const TOOLS = [
  {
    name: "creative_details",
    description:
      "One creative's full picture: last 7 days, the 14 days before, last 30 days (spend, views, CTR, frequency, Meta leads, CRM leads, booked calls, cost per lead and per booked call), age, ad set, utm_content, fatigue, today's call with its reason, and Marcel's corrections. Also shows Marcel a card with the numbers.",
    input_schema: { type: "object", properties: { ad: adParam }, required: ["ad"], additionalProperties: false },
  },
  {
    name: "credited_leads",
    description:
      "The CRM leads credited to one ad (newest first): contact id, short name, when they came in, booked / won, and whether Marcel already marked them not real. Use it before proposing to remove a lead or booked call. Also shows Marcel the list with names and emails.",
    input_schema: {
      type: "object",
      properties: { ad: adParam, days: { type: "integer", description: "How far back, 7–60 days (default 30)." } },
      required: ["ad"],
      additionalProperties: false,
    },
  },
  {
    name: "account_numbers",
    description: "Account totals for 7, 14, 30 or 90 days against the period before, plus campaigns and ad sets with their spend, CRM leads and booked calls.",
    input_schema: { type: "object", properties: { range: { type: "string", enum: ["7", "14", "30", "90"] } }, required: ["range"], additionalProperties: false },
  },
  {
    name: "tracking_check",
    description: "Meta's lead count against the leads the CRM actually got: the verdict, the last 14 days day by day, today so far, and ads where the two disagree.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "propose_remove_lead",
    description:
      "Propose that one CRM lead stop counting for an ad: what='lead' when it wasn't a real lead (a test, spam, a duplicate), what='booking' when the lead was real but the booked call didn't happen. Puts a card in the chat; nothing changes until Marcel taps Apply.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "The contact id from credited_leads." },
        ad: adParam,
        what: { type: "string", enum: ["lead", "booking"] },
        reason: { type: "string", description: "Why, in Marcel's words if he gave them (one sentence)." },
      },
      required: ["contact_id", "ad", "what", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_call",
    description:
      "Propose Marcel's own Cut or Keep on a live creative, overriding the rules for 1–30 days (then the rules decide again). Puts a card in the chat; nothing changes until Marcel taps Apply. Cutting still means he turns it off in Ads Manager.",
    input_schema: {
      type: "object",
      properties: {
        ad: adParam,
        call: { type: "string", enum: ["keep", "cut"] },
        days: { type: "integer", description: "How many days his call holds, 1–30 (default 7)." },
        reason: { type: "string", description: "Why (one sentence)." },
      },
      required: ["ad", "call", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_goals",
    description:
      "Propose new targets (USD) or a standing note for the account's Goals — the targets every Cut / Keep call is judged by. Give only what changes. Puts a card in the chat; nothing changes until Marcel taps Apply.",
    input_schema: {
      type: "object",
      properties: {
        target_cost_per_booked_usd: { type: "number" },
        target_cost_per_lead_usd: { type: "number" },
        monthly_budget_usd: { type: "number" },
        add_note: { type: "string", description: "A standing note to add (Manus and the morning plan read these)." },
        reason: { type: "string" },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
  {
    name: "offer_undo",
    description: "Show the card of a change Marcel already applied (by its id from account_now) so he can undo it with one tap.",
    input_schema: { type: "object", properties: { change_id: { type: "string" } }, required: ["change_id"], additionalProperties: false },
  },
  {
    name: "suggest_new_creatives",
    description: "Show a button that opens Create new creatives (Claude video ideas → Creative Studio) with a note to start from, e.g. when Marcel needs replacements.",
    input_schema: {
      type: "object",
      properties: { count: { type: "integer", description: "1–5" }, note: { type: "string", description: "What the new creatives should do, one or two sentences." } },
      required: ["count", "note"],
      additionalProperties: false,
    },
  },
];

const LAST_TOOLS = TOOLS.map((t, i) => (i === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t));

// ── Chat rows ─────────────────────────────────────────────

const turnsOf = (r: ChatRow) => (r.display as DisplayTurn[]) ?? [];

export function chatView(r: ChatRow): ChatView {
  const turns = turnsOf(r);
  const userTurns = turns.filter((t) => t.role === "user").length;
  return { id: r.id, turns, userTurns, full: userTurns >= CHAT_MAX_USER_TURNS, updatedAt: r.updatedAt.toISOString() };
}

export async function latestChat(ownerId: string, accountId: string): Promise<ChatRow | null> {
  const [row] = await db
    .select()
    .from(adChats)
    .where(and(eq(adChats.ownerId, ownerId), eq(adChats.accountId, accountId)))
    .orderBy(desc(adChats.updatedAt))
    .limit(1);
  return row ?? null;
}

export async function chatById(ownerId: string, accountId: string, id: string): Promise<ChatRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select()
    .from(adChats)
    .where(and(eq(adChats.id, id), eq(adChats.ownerId, ownerId), eq(adChats.accountId, accountId)))
    .limit(1);
  return row ?? null;
}

export async function newChat(ownerId: string, accountId: string, actorId: string): Promise<ChatRow> {
  const [row] = await db.insert(adChats).values({ ownerId, accountId, createdBy: actorId }).returning();
  return row;
}

// ── Context ───────────────────────────────────────────────

interface Ctx {
  ownerId: string;
  accountId: string;
  actorId: string;
  chatId: string;
  settings: AdSettingsRow;
  s: AdsSnapshot;
  plan: AdPlan;
  tz: string;
  changes: ChangeView[];
  emit: (e: ChatEvent) => void;
  push: (item: DisplayItem) => void;
}

const usd = (c: number | null | undefined) => (c === null || c === undefined ? null : Math.round(c) / 100);
const norm = (x: string) => x.toLowerCase().replace(/[“”"'‘’]/g, "").replace(/\s+/g, " ").trim();

/** An ad by id or name. Several names match: the live one, then the biggest spender — unless that's a real tie. */
export function findAd(s: AdsSnapshot, ref: unknown): { ad: AdRow } | { error: string } {
  const q = String(ref ?? "").trim();
  if (!q) return { error: "No ad given." };
  const id = q.replace(/^\[|\]$/g, "");
  const byId = s.ads.find((a) => a.id === id);
  if (byId) return { ad: byId };
  const n = norm(q);
  const exact = s.ads.filter((a) => norm(a.name) === n);
  const pool = exact.length ? exact : s.ads.filter((a) => norm(a.name).includes(n) || (n.length >= 8 && n.includes(norm(a.name))));
  if (!pool.length) return { error: `No ad matches "${q}". Use an id or name from account_now.` };
  const live = pool.filter((a) => a.effectiveStatus === "ACTIVE");
  const list = (live.length ? live : pool).sort((a, b) => (b.l30?.spendCents ?? 0) - (a.l30?.spendCents ?? 0));
  if (!exact.length && list.length > 1 && live.length > 1) {
    return { error: `"${q}" matches ${list.length} live ads: ${list.slice(0, 6).map((a) => `[${a.id}] "${a.name}"`).join(", ")}. Use the id.` };
  }
  return { ad: list[0] };
}

const windowOf = (m: Metrics | null): WindowNumbers | null =>
  m
    ? {
        spendCents: m.spendCents,
        impressions: m.impressions,
        ctr: m.ctr,
        frequency: m.frequency,
        metaLeads: m.metaLeads,
        crmLeads: m.ghlLeads,
        booked: m.booked,
        cplCents: m.ghlLeads ? Math.round(m.spendCents / m.ghlLeads) : null,
        cpbCents: m.booked ? Math.round(m.spendCents / m.booked) : null,
      }
    : null;

function cardOf(ctx: Ctx, ad: AdRow): CreativeCardData {
  const c = ctx.plan.calls.find((x) => x.adId === ad.id) ?? null;
  return {
    adId: ad.id,
    name: ad.name,
    thumbnailUrl: ad.creative.thumbnailUrl,
    adsManagerUrl: ad.adsManagerUrl,
    live: ad.effectiveStatus === "ACTIVE",
    adsetName: ctx.s.adsets.find((x) => x.id === ad.adsetId)?.name ?? "",
    ageDays: ad.ageDays,
    hasUtm: ad.creative.hasUtmContent,
    call: c ? { call: c.call, tag: c.tag ?? c.cutKind, reason: c.reason, done: c.done, yours: Boolean(c.override) } : null,
    w7: windowOf(ad.l7),
    w30: windowOf(ad.l30),
    fatigue: { state: ad.fatigue.state, reasons: ad.fatigue.reasons.slice(0, 3) },
    fixes: ctx.s.corrections?.leadFixes[ad.id] ?? null,
  };
}

const lean = (m: Metrics | null) => {
  const p = metricsPack(m);
  if (!p) return null;
  const { display: _display, ...rest } = p; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
};

function callText(c: CreativeCall): string {
  const kind = c.call === "cut" ? (c.done ? "CUT (already off)" : "CUT") : `KEEP · ${c.tag}`;
  return `${kind}${c.override ? ` · Marcel's call through ${dayLabel(c.override.untilDate)} (rules say ${c.override.ruleCall})` : ""}`;
}

/** The brief that rides in front of Marcel's message. */
function brief(ctx: Ctx, verdict: { title: string; detail: string } | null): string {
  const { s, plan } = ctx;
  const t = s.totals.cur;
  const lines: string[] = [];
  const weekday = new Date(`${plan.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  lines.push(`Today is ${weekday} (ad account time, ${ctx.tz}). Numbers are complete days through ${dayLabel(plan.throughDate)}.`);
  lines.push(
    `Targets: ${money(plan.targets.cpbCents)} per booked call (${plan.targets.cpbSource === "settings" ? "Goals" : plan.targets.cpbSource === "history" ? "account average" : "default"}), ${money(plan.targets.cplCents)} per lead (${plan.targets.cplSource === "settings" ? "Goals" : plan.targets.cplSource === "history" ? "60-day average" : "a third of the call target"}).`
  );
  lines.push(
    `Last ${s.range.days} days: ${money(t.spendCents)} spent · ${t.ghlLeads ?? "?"} CRM leads · ${t.booked ?? "?"} booked calls${t.booked ? ` (${money(Math.round(t.spendCents / t.booked))} each)` : ""} · Meta counted ${t.metaLeads} leads.`
  );
  lines.push("", `Live creatives — today's call (30-day numbers):`);
  for (const c of plan.calls) {
    const n = c.numbers;
    lines.push(
      `- [${c.adId}] "${c.name}" — ${callText(c)} — ${money(n.spendCents)} spent, ${n.leads} leads${c.leadsFrom === "meta" ? " (Meta's count: no utm_content)" : ""}, ${n.booked ?? "?"} booked${n.cplCents ? `, ${money(n.cplCents)}/lead` : ""}${n.cpbCents ? `, ${money(n.cpbCents)}/booked` : ""} · 7-day CTR ${pct(n.ctr7)}, frequency ${decimal(n.frequency7, 1)} — ${c.reason}${c.decideAt ? ` (decided at ${money(c.decideAt.spendCents)} spent)` : ""}`
    );
  }
  if (!plan.calls.length) lines.push("- (nothing running)");
  const off = s.ads.filter((a) => a.effectiveStatus !== "ACTIVE" && (a.l30?.spendCents ?? 0) > 0 && !plan.calls.some((c) => c.adId === a.id)).slice(0, 12);
  if (off.length) {
    lines.push("", "Off now, spent in the last 30 days:");
    for (const a of off) lines.push(`- [${a.id}] "${a.name}" — ${money(a.l30?.spendCents ?? 0)} spent, ${a.l30?.ghlLeads ?? "?"} leads, ${a.l30?.booked ?? "?"} booked`);
  }
  lines.push("", `Creatives to add: ${plan.need.add} (${plan.need.when.replace("_", " ")}) — ${plan.need.why}`);
  if (verdict) lines.push(`Tracking check: ${verdict.title}. ${verdict.detail}`);
  const applied = ctx.changes.filter((c) => c.status === "applied");
  const open = ctx.changes.filter((c) => c.status === "proposed");
  lines.push("", applied.length ? `Marcel's corrections in force:\n${applied.map((c) => `- [${c.id}] ${c.summary}`).join("\n")}` : "Marcel's corrections in force: none.");
  if (open.length) lines.push(`Cards waiting for Apply:\n${open.map((c) => `- [${c.id}] ${c.summary}`).join("\n")}`);
  if (ctx.settings.context.trim()) lines.push("", `Standing notes (Goals): ${ctx.settings.context.trim().slice(0, 1200)}`);
  return lines.join("\n");
}

// ── Leads with ids (the snapshot's own cached scan) ───────

async function leadsWithIds(ctx: Ctx): Promise<{ leads: CompactLead[]; error: string | null }> {
  const w = rangeWindows(30, ctx.tz);
  const scan = await loadLeads({ ownerId: ctx.ownerId, scanSince: w.scanSince, until: w.until, tz: ctx.tz });
  if (!scan.connected) return { leads: [], error: scan.error ?? "GoHighLevel isn't connected." };
  return { leads: scan.leads, error: scan.error };
}

function attributionOf(s: AdsSnapshot) {
  return buildAttribution(
    s.ads.map((a) => ({ id: a.id, name: a.name, campaignId: a.campaignId, adsetId: a.adsetId, spendCents: a.l30?.spendCents ?? a.metrics.cur.spendCents })),
    s.campaigns.map((c) => ({ id: c.id, name: c.name }))
  );
}

async function contactsOf(ids: string[]): Promise<Map<string, { first: string; last: string; email: string | null }>> {
  const out = new Map<string, { first: string; last: string; email: string | null }>();
  const queue = [...ids];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift() as string;
      const c = await getContactById("", id)
        .then((r) => r.contact)
        .catch(() => null);
      if (c) out.set(id, { first: (c.firstName ?? "").trim(), last: (c.lastName ?? "").trim(), email: c.email?.trim() || null });
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, ids.length) }, worker));
  return out;
}

const shortName = (c: { first: string; last: string } | undefined) => (c ? [c.first, c.last ? `${c.last[0]}.` : ""].filter(Boolean).join(" ") || "No name" : "Unknown");
const fullName = (c: { first: string; last: string } | undefined) => (c ? [c.first, c.last].filter(Boolean).join(" ") || "No name" : "Unknown");

function removedOf(changes: ChangeView[], contactId: string): "lead" | "booking" | null {
  const mine = changes.filter((c) => c.status === "applied" && (c.payload as LeadFixPayload)?.contactId === contactId);
  if (mine.some((c) => c.kind === "lead_not_real")) return "lead";
  if (mine.some((c) => c.kind === "booking_not_real")) return "booking";
  return null;
}

// ── Running a tool ────────────────────────────────────────

function toolLabel(ctx: Ctx, name: string, input: Record<string, unknown>): string | null {
  const ad = "ad" in input ? findAd(ctx.s, input.ad) : null;
  const nm = ad && "ad" in ad ? `“${ad.ad.name}”` : "the creative";
  switch (name) {
    case "creative_details":
      return `Looking at ${nm}`;
    case "credited_leads":
      return `Reading the leads credited to ${nm}`;
    case "account_numbers":
      return `Pulling the ${String(input.range ?? "30")}-day account numbers`;
    case "tracking_check":
      return "Checking Meta's leads against the CRM";
    case "propose_remove_lead":
    case "propose_call":
    case "propose_goals":
      return "Writing up a change for you to approve";
    default:
      return null;
  }
}

async function runTool(ctx: Ctx, name: string, input: Record<string, unknown>): Promise<{ content: string; isError?: boolean }> {
  const fail = (msg: string) => ({ content: JSON.stringify({ error: msg }), isError: true });
  const block = (b: ChatBlock) => {
    ctx.push({ type: "block", block: b });
    ctx.emit({ t: "block", block: b });
  };

  switch (name) {
    case "creative_details": {
      const f = findAd(ctx.s, input.ad);
      if ("error" in f) return fail(f.error);
      const a = f.ad;
      const c = ctx.plan.calls.find((x) => x.adId === a.id);
      block({ kind: "creative", card: cardOf(ctx, a) });
      return {
        content: JSON.stringify({
          ad_id: a.id,
          name: a.name,
          status: a.effectiveStatus,
          ad_set: ctx.s.adsets.find((x) => x.id === a.adsetId)?.name ?? null,
          campaign: ctx.s.campaigns.find((x) => x.id === a.campaignId)?.name ?? null,
          age_days: a.ageDays,
          media: a.creative.mediaType,
          headline: a.creative.headline,
          copy: a.creative.primaryText?.slice(0, 300) ?? null,
          utm_content_set: a.creative.hasUtmContent,
          lead_matching: a.attribution === "shared_name" ? "several ads share this name — the biggest spender gets the leads (best guess)" : a.attribution,
          last_7_days: lean(a.l7),
          days_8_to_21: lean(a.base14),
          last_30_days: lean(a.l30),
          fatigue: a.fatigue,
          winner: a.winner,
          todays_call: c ? { call: c.call, kind: c.tag ?? c.cutKind, reason: c.reason, action: c.action, decide_at_spend_usd: usd(c.decideAt?.spendCents), marcels_call: c.override ?? null } : "not running",
          marcels_corrections: ctx.changes.filter((x) => x.adId === a.id && x.status === "applied").map((x) => ({ id: x.id, summary: x.summary })),
          daily_spend_usd: a.daily.slice(-14).map((d) => [d.date, usd(d.spendCents)]),
        }),
      };
    }

    case "credited_leads": {
      const f = findAd(ctx.s, input.ad);
      if ("error" in f) return fail(f.error);
      const days = Math.max(7, Math.min(60, Math.round(Number(input.days) || 30)));
      const { leads, error } = await leadsWithIds(ctx);
      if (error && !leads.length) return fail(error);
      const attr = attributionOf(ctx.s);
      const win = bounds({ since: addDays(ctx.s.range.until, -(days - 1)), until: ctx.s.range.until }, ctx.tz);
      const mine = leads.filter((l) => l.d >= win[0] && l.d < win[1] && attr.adOf(l) === f.ad.id).sort((a, b) => b.d - a.d);
      const shown = mine.slice(0, 25);
      const people = await contactsOf(shown.map((l) => l.i).filter((x): x is string => Boolean(x)));
      const loc = await ghlLocationOf(ctx.ownerId).catch(() => null);
      const rows: LeadRowData[] = shown.map((l) => {
        const p = l.i ? people.get(l.i) : undefined;
        return {
          contactId: l.i ?? "",
          name: fullName(p),
          email: p?.email ?? null,
          at: new Date(l.d).toISOString(),
          booked: l.b === 1,
          won: l.w === 1,
          removed: l.i ? removedOf(ctx.changes, l.i) : null,
          ghlUrl: loc && l.i ? `https://app.gohighlevel.com/v2/location/${loc}/contacts/detail/${l.i}` : null,
        };
      });
      block({ kind: "leads", adId: f.ad.id, adName: f.ad.name, days, total: mine.length, booked: mine.filter((l) => l.b).length, rows });
      const at = (d: number) => new Date(d).toLocaleString("en-US", { timeZone: ctx.tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      return {
        content: JSON.stringify({
          ad: f.ad.name,
          days,
          total: mine.length,
          shown: shown.length,
          shared_name: f.ad.attribution === "shared_name",
          utm_content_set: f.ad.creative.hasUtmContent,
          leads: shown.map((l) => ({
            contact_id: l.i ?? null,
            who: shortName(l.i ? people.get(l.i) : undefined),
            came_in: at(l.d),
            platform: l.p === "f" ? "facebook" : l.p === "i" ? "instagram" : "meta",
            booked: l.b === 1,
            won: l.w === 1,
            marcel_marked: l.i ? removedOf(ctx.changes, l.i) : null,
          })),
          note: error ?? undefined,
        }),
      };
    }

    case "account_numbers": {
      const range = parseAdsRange(String(input.range ?? "30"));
      const r =
        range === "30"
          ? { configured: true as const, snapshot: ctx.s }
          : await buildAdsSnapshot({
              ownerId: ctx.ownerId,
              accountId: ctx.accountId,
              range,
              targets: { cpbCents: ctx.settings.targetCpbCents, cplCents: ctx.settings.targetCplCents, monthlyBudgetCents: ctx.settings.monthlyBudgetCents },
              budgetMs: 60_000,
            });
      if (!r.configured) return fail("Meta ads aren't connected.");
      const s = r.snapshot;
      const row = (x: { name: string; effectiveStatus: string; metrics: { cur: Metrics } }) => ({
        name: x.name,
        status: x.effectiveStatus,
        spend_usd: usd(x.metrics.cur.spendCents),
        crm_leads: x.metrics.cur.ghlLeads,
        booked: x.metrics.cur.booked,
        meta_leads: x.metrics.cur.metaLeads,
        cost_per_booked_usd: x.metrics.cur.booked ? usd(Math.round(x.metrics.cur.spendCents / x.metrics.cur.booked)) : null,
      });
      return {
        content: JSON.stringify({
          range: `${s.range.since} to ${s.range.until}`,
          previous: `${s.range.prevSince} to ${s.range.prevUntil}`,
          totals: { current: lean(s.totals.cur), previous: lean(s.totals.prev) },
          campaigns: s.campaigns.slice(0, 10).map(row),
          ad_sets: s.adsets.slice(0, 12).map(row),
          platforms: s.platforms.map((p) => ({ platform: p.label, spend_usd: usd(p.m.cur.spendCents), crm_leads: p.m.cur.ghlLeads, booked: p.m.cur.booked })),
          partial: s.partial.slice(0, 3),
        }),
      };
    }

    case "tracking_check": {
      const data = await loadTrackingData(ctx.ownerId, ctx.accountId).catch(() => null);
      const v = trackingVerdict({ data, snapshot: ctx.s });
      return {
        content: JSON.stringify({
          verdict: v.status,
          title: v.title,
          detail: v.detail,
          fixes: v.fixes,
          last_7_days: v.week,
          today: v.today?.text ?? null,
          days: v.days.map((d) => ({ date: d.date, spend_usd: usd(d.spendCents), meta_leads: d.metaLeads, crm_leads: d.crmLeads, booked: d.booked, flag: d.flag })),
          ads_that_disagree: v.ads.map((a) => ({ ad_id: a.adId, name: a.name, live: a.live, meta: a.meta, crm: a.crm, issue: a.issue, text: a.text, fix: a.fix })),
          note: "The tracking check uses the raw counts (before Marcel's corrections).",
        }),
      };
    }

    case "propose_remove_lead": {
      const f = findAd(ctx.s, input.ad);
      if ("error" in f) return fail(f.error);
      const what = input.what === "booking" ? "booking" : input.what === "lead" ? "lead" : null;
      if (!what) return fail("what must be 'lead' or 'booking'.");
      const contactId = String(input.contact_id ?? "").trim();
      const { leads, error } = await leadsWithIds(ctx);
      if (error && !leads.length) return fail(error);
      const lead = leads.find((l) => l.i === contactId);
      if (!lead) return fail("That contact isn't among the Meta leads of the last 60 days. Use a contact_id from credited_leads.");
      const attr = attributionOf(ctx.s);
      const credited = attr.adOf(lead);
      if (credited !== f.ad.id) {
        const other = ctx.s.ads.find((a) => a.id === credited);
        return fail(other ? `That lead is credited to "${other.name}" [${other.id}], not this ad.` : "That lead isn't credited to any ad.");
      }
      if (what === "booking" && !lead.b) return fail("That lead isn't counted as a booked call, so there's no booking to remove.");
      const already = removedOf(ctx.changes, contactId);
      if (already === "lead" || already === what) return fail("Marcel already corrected that lead.");
      const open = ctx.changes.find((c) => c.status === "proposed" && (c.payload as LeadFixPayload)?.contactId === contactId && c.kind === (what === "lead" ? "lead_not_real" : "booking_not_real"));
      if (open) {
        ctx.push({ type: "block", block: { kind: "change", changeId: open.id } });
        ctx.emit({ t: "block", block: { kind: "change", changeId: open.id } });
        return { content: JSON.stringify({ proposed: true, change_id: open.id, summary: open.summary, note: "This card was already waiting — shown again. Nothing has changed until Marcel taps Apply." }) };
      }
      const people = await contactsOf([contactId]);
      const who = shortName(people.get(contactId));
      const date = localDate(new Date(lead.d), ctx.tz);
      const payload: LeadFixPayload = { contactId, adId: f.ad.id, adName: f.ad.name, date, who };
      const summary =
        what === "lead"
          ? `Don't count ${who}'s lead (${dayLabel(date)}) on “${f.ad.name}”${lead.b ? " — nor its booked call" : ""}`
          : `Don't count ${who}'s booked call (${dayLabel(date)}) on “${f.ad.name}” — the lead still counts`;
      return propose(ctx, what === "lead" ? "lead_not_real" : "booking_not_real", f.ad.id, payload, summary, String(input.reason ?? ""));
    }

    case "propose_call": {
      const f = findAd(ctx.s, input.ad);
      if ("error" in f) return fail(f.error);
      const call = input.call === "keep" ? "keep" : input.call === "cut" ? "cut" : null;
      if (!call) return fail("call must be 'keep' or 'cut'.");
      const c = ctx.plan.calls.find((x) => x.adId === f.ad.id && !x.done);
      if (!c || f.ad.effectiveStatus !== "ACTIVE") return fail("That ad isn't running, so it has no call to change.");
      const ruleCall = c.override?.ruleCall ?? c.call;
      if (!c.override && ruleCall === call) return { content: JSON.stringify({ proposed: false, note: `The rules already say ${call} for it — nothing to change.` }) };
      const days = Math.max(1, Math.min(30, Math.round(Number(input.days) || 7)));
      const untilDate = addDays(ctx.plan.date, days);
      const payload: CallOverridePayload = { adId: f.ad.id, adName: f.ad.name, call, untilDate, ruleCall };
      const summary = `${call === "keep" ? "Keep" : "Cut"} “${f.ad.name}” — your call through ${dayLabel(untilDate)}${ruleCall !== call ? ` (the rules say ${ruleCall})` : ""}`;
      return propose(ctx, "call_override", f.ad.id, payload, summary, String(input.reason ?? ""));
    }

    case "propose_goals": {
      const before: GoalsValues = goalsOf(ctx.settings);
      const after: GoalsValues = { ...before };
      const cents = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 1 && n <= 1_000_000 ? Math.round(n * 100) : null;
      };
      const parts: string[] = [];
      if (input.target_cost_per_booked_usd !== undefined) {
        const v = cents(input.target_cost_per_booked_usd);
        if (v === null) return fail("target_cost_per_booked_usd must be between $1 and $1,000,000.");
        after.targetCpbCents = v;
        parts.push(`target per booked call ${money(before.targetCpbCents)} → ${money(v)}`);
      }
      if (input.target_cost_per_lead_usd !== undefined) {
        const v = cents(input.target_cost_per_lead_usd);
        if (v === null) return fail("target_cost_per_lead_usd must be between $1 and $1,000,000.");
        after.targetCplCents = v;
        parts.push(`target per lead ${before.targetCplCents ? money(before.targetCplCents) : "automatic"} → ${money(v)}`);
      }
      if (input.monthly_budget_usd !== undefined) {
        const v = cents(input.monthly_budget_usd);
        if (v === null) return fail("monthly_budget_usd must be between $1 and $1,000,000.");
        after.monthlyBudgetCents = v;
        parts.push(`monthly budget ${before.monthlyBudgetCents ? money(before.monthlyBudgetCents) : "not set"} → ${money(v)}`);
      }
      const note = typeof input.add_note === "string" ? input.add_note.trim().slice(0, 400) : "";
      if (note) {
        after.context = [before.context.trim(), `${dayLabel(ctx.plan.date)}: ${note}`].filter(Boolean).join("\n").slice(-2000);
        parts.push(`add a standing note: “${note}”`);
      }
      if (!parts.length) return fail("Nothing to change — give at least one target, the budget or a note.");
      const payload: GoalsPayload = { before, after };
      const summary = `Goals: ${parts.join(" · ")}`;
      return propose(ctx, "goals", null, payload, summary.charAt(0).toUpperCase() + summary.slice(1), String(input.reason ?? ""));
    }

    case "offer_undo": {
      const id = String(input.change_id ?? "").replace(/^\[|\]$/g, "");
      const c = ctx.changes.find((x) => x.id === id);
      if (!c || c.status !== "applied") return fail("No applied change with that id.");
      block({ kind: "change", changeId: c.id });
      return { content: JSON.stringify({ shown: true, summary: c.summary, note: "Marcel can tap Undo on the card." }) };
    }

    case "suggest_new_creatives": {
      const count = Math.max(1, Math.min(5, Math.round(Number(input.count) || 1)));
      const note = String(input.note ?? "").trim().slice(0, 600);
      block({ kind: "creatives", count, note });
      return { content: JSON.stringify({ shown: true, note: "A Create new creatives button is in the chat." }) };
    }
  }
  return fail(`Unknown tool ${name}.`);
}

async function propose(ctx: Ctx, kind: ChangeView["kind"], adId: string | null, payload: unknown, summary: string, reason: string) {
  const change = await proposeChange({ ownerId: ctx.ownerId, accountId: ctx.accountId, chatId: ctx.chatId, actorId: ctx.actorId, kind, adId, payload, summary, reason: reason.trim() });
  ctx.changes = [change, ...ctx.changes];
  ctx.emit({ t: "change", change });
  ctx.push({ type: "block", block: { kind: "change", changeId: change.id } });
  ctx.emit({ t: "block", block: { kind: "change", changeId: change.id } });
  return { content: JSON.stringify({ proposed: true, change_id: change.id, summary: change.summary, note: "A card is in the chat. Nothing has changed until Marcel taps Apply." }) };
}

// ── The turn ──────────────────────────────────────────────

/** Strip what can't be sent back after a mid-reply fallback (and find the blocks that count). */
export function afterFallback(content: Block[]): { live: Block[]; saved: Block[] } {
  const fb = content.map((b) => b.type).lastIndexOf("fallback");
  if (fb < 0) return { live: content, saved: content };
  const drop = new Set(["thinking", "redacted_thinking", "tool_use"]);
  return { live: content.slice(fb + 1), saved: [...content.slice(0, fb).filter((b) => !drop.has(b.type)), ...content.slice(fb)] };
}

/** The last message with a cache breakpoint on its last block (a copy — the stored history stays as it was). */
function withCacheMark(history: Msg[]): Msg[] {
  if (!history.length) return history;
  const last = history[history.length - 1];
  const content = typeof last.content === "string" ? [{ type: "text", text: last.content }] : (last.content as Block[]);
  if (!content.length) return history;
  const marked = [...content.slice(0, -1), { ...(content[content.length - 1] as Block), cache_control: { type: "ephemeral" } }];
  return [...history.slice(0, -1), { ...last, content: marked }];
}

export class ChatConflict extends Error {}

/**
 * One question from Marcel, answered (streamed through `emit`). Saves after
 * every round; if the reply fails part-way the model's history goes back to
 * how it was (the page keeps what was shown, with the error).
 */
export async function runChatTurn(o: { ownerId: string; accountId: string; actorId: string; chat: ChatRow; message: string; emit: (e: ChatEvent) => void }): Promise<void> {
  const started = Date.now();
  const { ownerId, accountId } = o;
  let version = o.chat.version;
  const prevMessages = (o.chat.messages as Msg[]) ?? [];
  const prevDisplay = turnsOf(o.chat);
  if (prevDisplay.filter((t) => t.role === "user").length >= CHAT_MAX_USER_TURNS) throw new Error("This chat is full — start a new chat to keep going.");

  const userTurn: DisplayTurn = { role: "user", at: new Date().toISOString(), items: [{ type: "text", text: o.message }] };
  const turn: DisplayTurn = { role: "assistant", at: new Date().toISOString(), items: [] };
  const save = async (messages: Msg[], briefHash: string | null) => {
    const [saved] = await db
      .update(adChats)
      .set({ messages, display: [...prevDisplay, userTurn, turn], briefHash, version: version + 1, updatedAt: new Date() })
      .where(and(eq(adChats.id, o.chat.id), eq(adChats.version, version)))
      .returning({ version: adChats.version });
    if (!saved) throw new ChatConflict("This chat was changed in another tab — reload the page.");
    version = saved.version;
  };

  // The numbers, the same way the page makes them.
  const settings = await getSettings(ownerId, accountId);
  const [s, stored, today, changes, tracking] = await Promise.all([
    snapshot30(ownerId, accountId, settings),
    latestPlan(ownerId, accountId).catch(() => null),
    planDateFor(ownerId, accountId).catch(() => null),
    listChanges(ownerId, accountId),
    loadTrackingData(ownerId, accountId).catch(() => null),
  ]);
  if (!s) throw new Error("Meta ads aren't connected.");
  const earlierCuts: Record<string, string> = {};
  const sp = stored?.plan as AdPlan | null | undefined;
  if (sp && stored?.planDate === today) for (const c of sp.calls) if (c.call === "cut") earlierCuts[c.adId] = c.reason;
  const plan = decideAds(s, { earlierCuts });

  const ctx: Ctx = {
    ownerId,
    accountId,
    actorId: o.actorId,
    chatId: o.chat.id,
    settings,
    s,
    plan,
    tz: s.account.timezone,
    changes,
    emit: o.emit,
    push: (item) => {
      turn.items = item.type === "text" ? addText(turn.items, item.text) : [...turn.items, item];
    },
  };
  const v = trackingVerdict({ data: tracking, snapshot: s });
  const b = brief(ctx, { title: v.title, detail: v.detail });
  const hash = createHash("sha1").update(b).digest("hex").slice(0, 16);
  const head = hash === o.chat.briefHash ? "<account_now>Same numbers as the last full account_now above.</account_now>" : `<account_now>\n${b}\n</account_now>`;
  const history: Msg[] = [...prevMessages, { role: "user", content: [{ type: "text", text: `${head}\n\n${o.message}` }] }];

  const client = new Anthropic({ timeout: 150_000, maxRetries: 1 });
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const last = round === MAX_ROUNDS - 1 || Date.now() - started > TURN_BUDGET_MS - 60_000;
      const params = {
        model: MODEL,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        max_tokens: 32_000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: LAST_TOOLS,
        tool_choice: last ? { type: "none" } : { type: "auto" },
        messages: withCacheMark(history),
      };
      const stream = client.beta.messages.stream(params as unknown as Parameters<typeof client.beta.messages.stream>[0]);
      stream.on("text", (d) => {
        ctx.push({ type: "text", text: d });
        o.emit({ t: "text", d });
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") throw new Error("Claude couldn't answer that one. Try asking it another way.");

      const { live, saved } = afterFallback(msg.content as unknown as Block[]);
      const cutOff = msg.stop_reason === "max_tokens";
      const uses = cutOff || last ? [] : (live.filter((x) => x.type === "tool_use") as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }[]);
      // A tool call that won't run never goes into the history (it would need a result).
      const content = uses.length ? saved : saved.filter((x) => x.type !== "tool_use");
      history.push({ role: "assistant", content: content.length ? content : [{ type: "text", text: "(no answer)" }] });
      if (!uses.length) {
        if (cutOff) turn.error = "The answer got cut off — ask it to go on.";
        else if (!turn.items.some((i) => i.type === "text")) turn.error = "Claude didn't write an answer — try asking again.";
        await save(history, hash);
        break;
      }

      const results: Block[] = [];
      for (const u of uses) {
        const input = u.input && typeof u.input === "object" ? u.input : {};
        const label = toolLabel(ctx, u.name, input);
        if (label) {
          ctx.push({ type: "tool", label });
          o.emit({ t: "tool", label });
        }
        let r: { content: string; isError?: boolean };
        try {
          r = await runTool(ctx, u.name, input);
        } catch (err) {
          console.error(`[ads chat] tool ${u.name} failed:`, err instanceof Error ? err.message : err);
          r = { content: JSON.stringify({ error: "That lookup failed just now. Say so, or try a different way." }), isError: true };
        }
        results.push({ type: "tool_result", tool_use_id: u.id, content: r.content.slice(0, RESULT_MAX), ...(r.isError ? { is_error: true } : {}) });
      }
      history.push({ role: "user", content: results });
      await save(history, hash);
    }
  } catch (err) {
    if (err instanceof ChatConflict) throw err;
    const message = err instanceof Error && /couldn't answer|connected/.test(err.message) ? err.message : "Claude didn't finish answering — try again in a moment.";
    console.error("[ads chat] turn failed:", err instanceof Error ? err.message : err);
    turn.error = message;
    // The model's history goes back to before this question; the page keeps what was shown.
    await save(prevMessages, o.chat.briefHash).catch(() => {});
    o.emit({ t: "error", message });
    o.emit({ t: "done", turn });
    return;
  }
  o.emit({ t: "done", turn });
}
