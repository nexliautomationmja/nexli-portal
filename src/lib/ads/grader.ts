import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { adGrades, adGraderRuns, adVideoReads } from "@/lib/ads/tables";
import { getSettings, type AdSettingsRow } from "@/lib/ads/settings";
import { buildAdsSnapshot, cachedAdCreatives } from "@/lib/ads/snapshot";
import { structured } from "@/lib/ads/creative-ai";
import { latestResearchForPack } from "@/lib/ads/research-service";
import type { ResearchPackSummary } from "@/lib/ads/research-pack";
import { getAdCreativesMeta } from "@/lib/meta-ads";
import { decideAds } from "@/lib/ads/decide";
import { money, pct } from "@/lib/ads/format";
import { median } from "@/lib/ads/math";
import { ANGLES, FORMATS } from "@/lib/ads/creative-types";
import type { AdRow, AdsSnapshot } from "@/lib/ads/types";
import { creativeAssets, creativeEdits, creativeProjects } from "@/lib/creative-studio/tables";
import { removePaths, signPaths } from "@/lib/creative-studio/storage";
import { MediaError, frameUrls, watchStill, watchVideo } from "@/lib/ads/grader-media";
import {
  BAND,
  CAPS,
  CLAUDE_CAPS,
  HOOK_TYPES,
  OUTCOME,
  PROOF_KINDS,
  RUBRIC,
  RUBRIC_KEYS,
  RUBRIC_VERSION,
  bandOf,
  codeCaps,
  conceptClusters,
  confidenceOf,
  isNearCopy,
  nearest,
  outcomeLabel,
  produced,
  scoreFixes,
  scoreOf,
  suggestLinks,
  trackRecord,
  validateEvidence,
  type CapKey,
  type CreativeRead,
  type EvidenceRef,
  type GradeResult,
  type GradeView,
  type GraderState,
  type LiveResult,
  type NearestAd,
  type Outcome,
  type OutcomeLabel,
  type RawFix,
  type RawSub,
  type ReadMedia,
  type SimInput,
  type TrackRecord,
} from "@/lib/ads/grader-shared";

/**
 * The Ad Grader (server). Three jobs:
 *  - Learn the account: watch Marcel's past video ads once each (stills +
 *    timed words, then Claude's neutral read of what's in them) and join
 *    them with how they did — his real Meta and CRM numbers.
 *  - Grade a creative before it gets spend: the same read, then Claude
 *    scores it against those videos and the long-running ads in his niche,
 *    citing evidence for every line; the code adds it up, applies the hard
 *    caps and drops anything uncited.
 *  - Prove it: grade his past videos blind (no names, no results, the
 *    video's own look-alikes left out) and compare with what happened.
 * Every step saves before the next, so the page (and the cron) can carry a
 * job on across several requests.
 */

const READ_VERSION = "r1";
const LEARN_TOP = 20;
const LEARN_MAX = 24;
export const GRADE_DAILY_CAP = 40;
const BACKTEST_MIN = 6;
const POOL_MAX = 20;
const STALE_CLAIM = sql`now() - interval '5 minutes'`;

type ReadRow = typeof adVideoReads.$inferSelect;
type GradeRow = typeof adGrades.$inferSelect;

const rowsOf = <T>(res: unknown): T[] => ((res as { rows?: T[] }).rows ?? (res as T[])) || [];
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 400);
const readKeyOf = (a: AdRow) => (a.creative.videoId ? `v:${a.creative.videoId}` : `a:${a.id}`);
const isVideoAd = (a: AdRow) => a.creative.mediaType === "video" || (a.metrics.cur.videoViews3s ?? 0) > 0;

// ── Claude's neutral read of a creative ────────────────────

const READ_SYSTEM = `You describe one video ad (or one still) for Nexli's ad grader. Nexli sells the Digital Rainmaker System — done-for-you client acquisition (Meta ads, landing page, follow-up, booked strategy calls) — to owners of US CPA and accounting firms; every ad's job is to get the right firm owner to book a free strategy call.

You get stills with the second each was taken at (the first ones cover the opening 3 seconds, the last one the very end), every spoken word with its time, and the ad's copy when it ran in Meta. Describe what is there — never judge whether it is good. Quote spoken and on-screen words exactly. Plain, specific words.

- format: what the video mostly is. angle: the main angle (pain-led, proof, how it works, offer, authority, curiosity).
- presenter: who's on screen in a few words ("Daniela, AI presenter at a desk"; "no one — text over b-roll").
- hook: the first 3 seconds — what is seen, what is said (exact words), what's written on screen, its type, and whether it names or clearly calls out accounting/CPA firm owners.
- offer: what is offered or promised, in a sentence ("" if nothing). proof: numbers, client results, authority, a demo, testimonials, or none.
- cta: the ask in words, when it comes, and whether it asks to book a call.
- captions: burned-in captions present, and readable (big enough, high contrast) on a phone. sound_off_readable: would the message land with the sound off.
- safe_zone_issues: text or faces in the top 14% or bottom 20% of a vertical frame (where Meta's interface covers it), or anything cut off. Empty when fine.
- pacing: slow / steady / fast cuts and speech. beats: 2–6 short lines, the video's beats in order. summary: one sentence.
- claims_risk: anything that promises results or income, guarantees, or claims about the IRS or government. Empty when none.`;

const READ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["format", "angle", "presenter", "hook", "offer", "proof", "cta", "captions", "sound_off_readable", "safe_zone_issues", "pacing", "beats", "summary", "claims_risk"],
  properties: {
    format: { type: "string", enum: Object.keys(FORMATS) },
    angle: { type: "string", enum: Object.keys(ANGLES) },
    presenter: { type: "string" },
    hook: {
      type: "object",
      additionalProperties: false,
      required: ["visual", "spoken", "on_screen_text", "type", "names_audience"],
      properties: { visual: { type: "string" }, spoken: { type: "string" }, on_screen_text: { type: "string" }, type: { type: "string", enum: [...HOOK_TYPES] }, names_audience: { type: "boolean" } },
    },
    offer: { type: "string" },
    proof: { type: "object", additionalProperties: false, required: ["kind", "detail"], properties: { kind: { type: "string", enum: [...PROOF_KINDS] }, detail: { type: "string" } } },
    cta: {
      type: "object",
      additionalProperties: false,
      required: ["text", "when", "book_call"],
      properties: { text: { type: "string" }, when: { type: "string", enum: ["none", "early", "end", "throughout"] }, book_call: { type: "boolean" } },
    },
    captions: { type: "object", additionalProperties: false, required: ["burned_in", "readable"], properties: { burned_in: { type: "boolean" }, readable: { type: "boolean" } } },
    sound_off_readable: { type: "boolean" },
    safe_zone_issues: { type: "array", items: { type: "string" } },
    pacing: { type: "string", enum: ["slow", "steady", "fast"] },
    beats: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    claims_risk: { type: "array", items: { type: "string" } },
  },
} as const;

/** Timed lines from the words: "[0.4] Still waiting on referrals…". */
function timedLines(words: ReadMedia["words"], maxChars = 5000): string {
  const lines: string[] = [];
  let cur: string[] = [];
  let start = 0;
  for (const w of words) {
    if (!cur.length) start = w.start;
    cur.push(w.text);
    if (/[.!?]$/.test(w.text) || w.end - start > 4) {
      lines.push(`[${start.toFixed(1)}] ${cur.join(" ")}`);
      cur = [];
    }
  }
  if (cur.length) lines.push(`[${start.toFixed(1)}] ${cur.join(" ")}`);
  return lines.join("\n").slice(0, maxChars);
}

type ImageBlock = { type: "image"; source: { type: "url"; url: string } };
type TextBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

async function frameBlocks(media: ReadMedia, label: (t: number) => string): Promise<(ImageBlock | TextBlock)[]> {
  const urls = await frameUrls(media.frames.map((f) => f.path));
  const out: (ImageBlock | TextBlock)[] = [];
  for (const f of media.frames) {
    const url = urls.get(f.path);
    if (!url) continue;
    out.push({ type: "text", text: label(f.t) });
    out.push({ type: "image", source: { type: "url", url } });
  }
  return out;
}

export async function readCreative(media: ReadMedia, copy: { headline?: string | null; primaryText?: string | null } = {}): Promise<CreativeRead> {
  const content: (ImageBlock | TextBlock)[] = [
    {
      type: "text",
      text: `${media.kind === "video" ? `Video, ${media.durationS ?? "?"} s, ${media.width ?? "?"}×${media.height ?? "?"}, ${media.hasAudio ? "with sound" : "no sound"}.` : `Still image, ${media.width ?? "?"}×${media.height ?? "?"}.`}${media.quality === "still_only" && media.kind === "video" ? " Only the cover still could be read — describe what it shows and leave what you can't see empty." : ""}`,
    },
    ...(await frameBlocks(media, (t) => (media.quality === "still_only" ? "The still:" : `Still at ${t.toFixed(1)} s:`))),
    { type: "text", text: media.words.length ? `Spoken words (seconds):\n${timedLines(media.words)}` : media.kind === "video" ? (media.hasAudio ? "No words could be transcribed." : "No sound.") : "" },
  ];
  if (copy.headline || copy.primaryText) content.push({ type: "text", text: `Its copy in Meta:\nHeadline: ${copy.headline ?? "—"}\nPrimary text: ${(copy.primaryText ?? "—").slice(0, 800)}` });
  const raw = (await structured(
    { max_tokens: 6000, system: READ_SYSTEM, messages: [{ role: "user", content: content.filter((b) => b.type !== "text" || b.text) }], output_config: { effort: "medium", format: { type: "json_schema", schema: READ_SCHEMA } } },
    120_000
  )) as Record<string, never>;
  const r = raw as unknown as {
    format: CreativeRead["format"];
    angle: CreativeRead["angle"];
    presenter: string;
    hook: { visual: string; spoken: string; on_screen_text: string; type: CreativeRead["hook"]["type"]; names_audience: boolean };
    offer: string;
    proof: CreativeRead["proof"];
    cta: { text: string; when: CreativeRead["cta"]["when"]; book_call: boolean };
    captions: { burned_in: boolean; readable: boolean };
    sound_off_readable: boolean;
    safe_zone_issues: string[];
    pacing: CreativeRead["pacing"];
    beats: string[];
    summary: string;
    claims_risk: string[];
  };
  return {
    v: 1,
    format: r.format,
    angle: r.angle,
    presenter: String(r.presenter ?? "").slice(0, 120),
    hook: { visual: r.hook?.visual ?? "", spoken: r.hook?.spoken ?? "", onScreenText: r.hook?.on_screen_text ?? "", type: r.hook?.type ?? "none", namesAudience: Boolean(r.hook?.names_audience) },
    offer: String(r.offer ?? "").slice(0, 300),
    proof: { kind: r.proof?.kind ?? "none", detail: String(r.proof?.detail ?? "").slice(0, 300) },
    cta: { text: String(r.cta?.text ?? "").slice(0, 200), when: r.cta?.when ?? "none", bookCall: Boolean(r.cta?.book_call) },
    captions: { burnedIn: Boolean(r.captions?.burned_in), readable: Boolean(r.captions?.readable) },
    soundOffReadable: Boolean(r.sound_off_readable),
    safeZoneIssues: (r.safe_zone_issues ?? []).slice(0, 6).map((x) => String(x).slice(0, 160)),
    pacing: r.pacing ?? "steady",
    beats: (r.beats ?? []).slice(0, 6).map((x) => String(x).slice(0, 160)),
    summary: String(r.summary ?? "").slice(0, 300),
    claimsRisk: (r.claims_risk ?? []).slice(0, 6).map((x) => String(x).slice(0, 200)),
  };
}

// ── The account: past videos and how they did ─────────────

interface Judged {
  readKey: string;
  videoId: string | null;
  adIds: string[];
  name: string;
  read: CreativeRead;
  media: ReadMedia;
  outcome: Outcome;
  label: OutcomeLabel;
  hookRate: number | null;
  holdRate: number | null;
  ctr: number | null;
  cplCents: number | null;
  cpbCents: number | null;
  rankings: AdRow["rankings"];
}

interface AccountCtx {
  ownerId: string;
  accountId: string;
  settings: AdSettingsRow;
  s: AdsSnapshot | null;
  tCpb: number;
  tCpl: number;
  /** Every read past video with its outcome (too_little included). */
  all: Judged[];
  research: ResearchPackSummary | null;
}

interface Group {
  readKey: string;
  videoId: string | null;
  ads: AdRow[];
  outcome: Outcome;
}

/** Ads grouped by the video they play, with their summed 90-day outcome. */
function groupsOf(s: AdsSnapshot): Group[] {
  const by = new Map<string, Group>();
  for (const a of s.ads) {
    if (!isVideoAd(a)) continue;
    const m = a.metrics.cur;
    const k = readKeyOf(a);
    const g = by.get(k) ?? { readKey: k, videoId: a.creative.videoId ?? null, ads: [], outcome: { spendCents: 0, impressions: 0, linkClicks: 0, views3s: 0, thruplays: 0, leads: 0, booked: null } };
    const crm = m.ghlLeads !== null && a.creative.hasUtmContent !== false;
    g.ads.push(a);
    g.outcome.spendCents += m.spendCents;
    g.outcome.impressions += m.impressions;
    g.outcome.linkClicks += m.linkClicks;
    g.outcome.views3s += m.videoViews3s;
    g.outcome.thruplays += m.thruplays;
    g.outcome.leads += crm ? (m.ghlLeads ?? 0) : m.metaLeads;
    if (crm) g.outcome.booked = (g.outcome.booked ?? 0) + (m.booked ?? 0);
    by.set(k, g);
  }
  return [...by.values()];
}

async function snapshot90(ownerId: string, accountId: string, settings: AdSettingsRow): Promise<AdsSnapshot | null> {
  const targets = { cpbCents: settings.targetCpbCents, cplCents: settings.targetCplCents, monthlyBudgetCents: settings.monthlyBudgetCents };
  const r = await buildAdsSnapshot({ ownerId, accountId, range: "90", targets, budgetMs: 70_000 });
  return r.configured ? r.snapshot : null;
}

async function accountContext(ownerId: string, accountId: string): Promise<AccountCtx> {
  const settings = await getSettings(ownerId, accountId);
  const [s, rows, research] = await Promise.all([
    snapshot90(ownerId, accountId, settings),
    db
      .select()
      .from(adVideoReads)
      .where(and(eq(adVideoReads.ownerId, ownerId), eq(adVideoReads.accountId, accountId), inArray(adVideoReads.status, ["done", "partial"]))),
    latestResearchForPack(ownerId, accountId).catch(() => null),
  ]);
  const tCpb = s?.targetCpb.cents ?? settings.targetCpbCents ?? 30000;
  const tCpl = s?.targetCpl?.cents ?? Math.round(tCpb / 3);
  const groups = new Map((s ? groupsOf(s) : []).map((g) => [g.readKey, g]));
  const all: Judged[] = [];
  for (const r of rows) {
    if (!r.read || !r.media) continue;
    const g = groups.get(r.readKey);
    if (!g) continue;
    const o = g.outcome;
    const top = [...g.ads].sort((a, b) => b.metrics.cur.spendCents - a.metrics.cur.spendCents)[0];
    all.push({
      readKey: r.readKey,
      videoId: r.videoId,
      adIds: g.ads.map((a) => a.id),
      name: top?.name ?? r.readKey,
      read: r.read as CreativeRead,
      media: r.media as ReadMedia,
      outcome: o,
      label: outcomeLabel(o, { cpbCents: tCpb, cplCents: tCpl }),
      hookRate: o.impressions > 0 && o.views3s > 0 ? o.views3s / o.impressions : null,
      holdRate: o.views3s > 0 ? o.thruplays / o.views3s : null,
      ctr: o.impressions > 0 ? o.linkClicks / o.impressions : null,
      cplCents: o.leads > 0 ? Math.round(o.spendCents / o.leads) : null,
      cpbCents: o.booked ? Math.round(o.spendCents / o.booked) : null,
      rankings: top?.rankings ?? null,
    });
  }
  return { ownerId, accountId, settings, s, tCpb, tCpl, all, research };
}

const simOf = (read: CreativeRead | null, media: ReadMedia | null): SimInput => ({
  text: media?.text || [read?.hook.spoken, ...(read?.beats ?? [])].filter(Boolean).join(" "),
  format: read?.format ?? null,
  angle: read?.angle ?? null,
  hookType: read?.hook.type ?? null,
  presenter: read?.presenter ?? null,
});

// ── Learning the account ───────────────────────────────────

/** Queue the past videos worth learning from (biggest spenders + anything new with a first look). */
export async function planLearn(ownerId: string, accountId: string, actorId: string | null): Promise<{ queued: number; total: number }> {
  const settings = await getSettings(ownerId, accountId);
  const s = await snapshot90(ownerId, accountId, settings);
  if (!s) throw new Error("Meta ads aren't connected.");
  const tCpl = s.targetCpl?.cents ?? Math.round(s.targetCpb.cents / 3);
  const groups = groupsOf(s).filter((g) => g.outcome.spendCents >= tCpl || g.outcome.impressions >= 3000);
  const bySpend = [...groups].sort((a, b) => b.outcome.spendCents - a.outcome.spendCents);
  const pick = new Map(bySpend.slice(0, LEARN_TOP).map((g) => [g.readKey, g]));
  for (const g of groupsOf(s)) {
    if (pick.size >= LEARN_MAX) break;
    if (g.ads.some((a) => (a.ageDays ?? 99) <= 14) && g.outcome.impressions >= 1500) pick.set(g.readKey, g);
  }
  const list = [...pick.values()];
  if (!list.length) return { queued: 0, total: 0 };
  const inserted = await db
    .insert(adVideoReads)
    .values(list.map((g, i) => ({ ownerId, accountId, readKey: g.readKey, videoId: g.videoId, adIds: g.ads.map((a) => a.id), priority: list.length - i })))
    .onConflictDoNothing()
    .returning({ k: adVideoReads.readKey });
  // Known videos: keep their ad list current.
  for (const g of list) {
    if (inserted.some((r) => r.k === g.readKey)) continue;
    await db
      .update(adVideoReads)
      .set({ adIds: g.ads.map((a) => a.id), updatedAt: new Date() })
      .where(and(eq(adVideoReads.ownerId, ownerId), eq(adVideoReads.accountId, accountId), eq(adVideoReads.readKey, g.readKey)));
  }
  const open = await openReads(ownerId, accountId);
  if (open > 0) {
    await db.insert(adGraderRuns).values({ ownerId, accountId, kind: "learn", total: open, rubricVersion: READ_VERSION, startedBy: actorId }).onConflictDoNothing();
  } else {
    // Nothing new to watch: still mark the check, so the daily look doesn't repeat every 10 minutes.
    await db.insert(adGraderRuns).values({ ownerId, accountId, kind: "learn", status: "done", total: 0, rubricVersion: READ_VERSION, startedBy: actorId, finishedAt: new Date() });
  }
  return { queued: inserted.length, total: list.length };
}

async function openReads(ownerId: string, accountId: string): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS n FROM ad_video_reads
    WHERE owner_id = ${ownerId} AND account_id = ${accountId}
      AND (status IN ('queued', 'reading') OR (status = 'failed' AND attempts < 3))
  `);
  return Number(rowsOf<{ n: number }>(res)[0]?.n ?? 0);
}

async function claimRead(ownerId: string, accountId: string): Promise<ReadRow | null> {
  const res = await db.execute(sql`
    UPDATE ad_video_reads SET status = 'reading', claimed_at = now(), attempts = attempts + 1, updated_at = now()
    WHERE (owner_id, account_id, read_key) = (
      SELECT owner_id, account_id, read_key FROM ad_video_reads
      WHERE owner_id = ${ownerId} AND account_id = ${accountId}
        AND (status = 'queued'
          OR (status = 'failed' AND attempts < 3 AND (retry_after IS NULL OR retry_after < now()))
          OR (status = 'reading' AND claimed_at < ${STALE_CLAIM}))
      ORDER BY priority DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING read_key
  `);
  const key = rowsOf<{ read_key: string }>(res)[0]?.read_key;
  if (!key) return null;
  const [row] = await db.select().from(adVideoReads).where(and(eq(adVideoReads.ownerId, ownerId), eq(adVideoReads.accountId, accountId), eq(adVideoReads.readKey, key))).limit(1);
  return row ?? null;
}

const readPrefix = (ownerId: string, readKey: string) => `adgrade/${ownerId}/reads/${createHash("sha1").update(readKey).digest("hex").slice(0, 16)}`;

/** Watch and read one past video. */
async function processRead(row: ReadRow, deadline: number): Promise<void> {
  const set = (patch: Partial<typeof adVideoReads.$inferInsert>) =>
    db
      .update(adVideoReads)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(adVideoReads.ownerId, row.ownerId), eq(adVideoReads.accountId, row.accountId), eq(adVideoReads.readKey, row.readKey)));
  try {
    const metaRes = await getAdCreativesMeta((row.adIds ?? []).slice(0, 4));
    const metas = metaRes.ok ? Object.values(metaRes.byId) : [];
    const withVideo = metas.find((m) => m.videoUrl);
    const any = withVideo ?? metas.find((m) => m.posterUrl || m.thumbnailUrl);
    if (!any) {
      await set({ status: "unavailable", error: metaRes.ok ? "Meta didn't return this ad's video or picture." : metaRes.error, claimedAt: null });
      return;
    }
    const prefix = readPrefix(row.ownerId, row.readKey);
    let media: ReadMedia;
    if (withVideo?.videoUrl) {
      try {
        media = await watchVideo(withVideo.videoUrl, prefix, { deadline });
      } catch (err) {
        const still = withVideo.posterUrl || withVideo.thumbnailUrl;
        if (!(err instanceof MediaError) || !still) throw err;
        media = await watchStill(still, prefix, "video");
      }
    } else {
      media = await watchStill((any.posterUrl || any.thumbnailUrl) as string, prefix, "video");
    }
    // The same file read before (another ad set's copy): reuse its read.
    if (media.fileHash) {
      const [same] = await db
        .select()
        .from(adVideoReads)
        .where(and(eq(adVideoReads.ownerId, row.ownerId), eq(adVideoReads.accountId, row.accountId), eq(adVideoReads.fileHash, media.fileHash), eq(adVideoReads.status, "done")))
        .limit(1);
      if (same?.read && same.readKey !== row.readKey) {
        await set({ status: "done", media, read: same.read, readVersion: same.readVersion, fileHash: media.fileHash, error: null, claimedAt: null });
        return;
      }
    }
    const read = await readCreative(media, { headline: any.headline, primaryText: any.primaryText });
    await set({ status: media.quality === "still_only" ? "partial" : "done", media, read, readVersion: READ_VERSION, fileHash: media.fileHash, error: media.transcriptError, claimedAt: null });
  } catch (err) {
    console.error("[ads grader] read failed:", row.readKey, errText(err));
    await set({ status: "failed", error: errText(err), retryAfter: new Date(Date.now() + 10 * 60_000), claimedAt: null });
  }
}

/** Read past videos until the deadline (2 at a time). Finishes the learn run when nothing's left. */
export async function advanceLearn(ownerId: string, accountId: string, deadline: number): Promise<{ read: number; left: number }> {
  let read = 0;
  const worker = async () => {
    while (Date.now() < deadline - 100_000) {
      const row = await claimRead(ownerId, accountId);
      if (!row) return;
      await processRead(row, deadline - 20_000);
      read++;
    }
  };
  await Promise.all([worker(), worker()]);
  const left = await openReads(ownerId, accountId);
  if (left === 0) {
    const [finished] = await db
      .update(adGraderRuns)
      .set({ status: "done", finishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(adGraderRuns.ownerId, ownerId), eq(adGraderRuns.accountId, accountId), eq(adGraderRuns.kind, "learn"), eq(adGraderRuns.status, "running")))
      .returning();
    // First time the account is learned (or the rubric changed): check the grader blind.
    if (finished) await startBacktest(ownerId, accountId, finished.startedBy, { auto: true }).catch((err) => console.warn("[ads grader] auto backtest:", errText(err)));
  } else {
    await db
      .update(adGraderRuns)
      .set({ updatedAt: new Date() })
      .where(and(eq(adGraderRuns.ownerId, ownerId), eq(adGraderRuns.accountId, accountId), eq(adGraderRuns.kind, "learn"), eq(adGraderRuns.status, "running")));
  }
  return { read, left };
}

// ── The evidence pack and the grade ────────────────────────

const GRADE_SYSTEM = `You grade one Meta video ad for Marcel, who owns Nexli. Nexli sells the Digital Rainmaker System — done-for-you client acquisition (Meta ads, landing page, follow-up, booked strategy calls) — to owners of US CPA and accounting firms. Every ad has one job: get the right firm owner to book a free strategy call. Marcel tests many creatives and wants to stop paying for ones that were never worth publishing. He asked for no feel-good grading.

You judge against evidence, not taste:
- His own videos (A1, A2 …): what each one is and exactly how it did — booked calls, leads, cost, 3-second view rate (the hook), hold rate, CTR, and Meta's own quality / engagement / conversion rankings when Meta reported them.
- Account stats (S1 …), worked out from those videos.
- Long-running ads in his niche (N1 …) — kept running 30+ days, so they likely work for someone — and the market patterns (P1 …), from his Ad Library research.
- Facts about the candidate the code measured (F1 …), and its stills (T0, T0.5 … T is seconds).

Score each line 0–10:
- hook (25): the first 3 seconds (stills T0–T3 and the words said by 3 s). Would a firm owner stop scrolling? Compare with the opening of his videos with the highest and lowest 3-second view rates. 10 = beats his best hook on the same things that made it work; 5 = ordinary; 0 = nothing happens for 3 seconds.
- message (20): the angle, pain and offer against what booked calls or brought cheap leads for him, and what flopped. 10 = the pattern of his winners, sharpened; 0 = the pattern of his flops.
- meta_fit (15): vertical 9:16, burned-in captions readable on a phone with the sound off, text and faces clear of the top 14% and bottom 20%, length 15–45 s, pace that holds.
- proof (10): specific numbers, results, authority, a demo; 0 = claims with nothing behind them.
- cta (10): a clear ask to book the free strategy call, at the end and ideally earlier too.
- fresh (10): new to his audience — not a re-run of his videos, especially flops — while borrowing what's proven in the niche with his own twist.
- audience (10): speaks to firm owners (not taxpayers or job seekers), in their words.

Rules:
- Cite evidence for every line with refs exactly as given (A3, S1, N2, P1, F2, T1.5) and a short point. A line you can't tie to evidence gets 5 at most — the code enforces that.
- A typical untested cold creative scores 45–60. 80+ only when it matches or beats his best videos on hook, message and craft, with the numbers to show it. Don't round up.
- Say what's wrong first. No praise words, no softening. Never invent numbers — only use the ones given.
- If his account has little data for a line, say so in "why" instead of guessing.
- caps: mark applies=true (with the ref that shows it) when: talking on camera with no captions (no_captions_talking_head); nothing in the first 3 seconds that could stop a scroll (no_hook_in_3s); not aimed at firm owners (wrong_audience); it promises results or income, guarantees, or claims anything about the IRS or government (policy_risk); it never asks for the call (no_cta). Otherwise applies=false.
- fixes: up to 5, most valuable first. Each is a concrete edit (exact words for a new hook or caption where it helps), the line it raises, the score that line would reach (to), and the cap it removes ("none" if none). Only fixes that can be made to this video or a re-shoot of it.
- fixed_brief: 80–180 words a script writer can use to make the fixed version: who's on screen, the hook line word for word, 2–4 beats, captions, and the ask to book a free strategy call. No prices, no promises of results or income, nothing about the IRS or government, never a competitor's words or names.
- verdict_line: one blunt sentence (25 words max) — should he put money behind it.
- upside: how much better it could do with the fixes (low / medium / high) and why, in a sentence.`;

const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subscores", "caps", "fixes", "fixed_brief", "verdict_line", "upside", "upside_why"],
  properties: {
    subscores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "score", "why", "evidence"],
        properties: {
          key: { type: "string", enum: RUBRIC_KEYS },
          score: { type: "integer" },
          why: { type: "string" },
          evidence: { type: "array", items: { type: "object", additionalProperties: false, required: ["ref", "point"], properties: { ref: { type: "string" }, point: { type: "string" } } } },
        },
      },
    },
    caps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "applies", "why", "ref"],
        properties: { key: { type: "string", enum: CLAUDE_CAPS }, applies: { type: "boolean" }, why: { type: "string" }, ref: { type: "string" } },
      },
    },
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "what", "subscore", "to", "removes_cap"],
        properties: {
          title: { type: "string" },
          what: { type: "string" },
          subscore: { type: "string", enum: RUBRIC_KEYS },
          to: { type: "integer" },
          removes_cap: { type: "string", enum: [...Object.keys(CAPS), "none"] },
        },
      },
    },
    fixed_brief: { type: "string" },
    verdict_line: { type: "string" },
    upside: { type: "string", enum: ["low", "medium", "high"] },
    upside_why: { type: "string" },
  },
};

const r2 = (v: number | null) => (v === null ? "—" : pct(v));

function adLine(ref: string, j: Judged, withRankings: boolean): string {
  const o = j.outcome;
  const result =
    j.label === "winner" || j.label === "booked_expensive"
      ? `${o.booked} booked at ${money(j.cpbCents)} each; ${o.leads} leads`
      : o.leads
        ? `${o.leads} leads at ${money(j.cplCents)} each, none booked${o.booked === null ? " (no CRM credit — Meta's lead count)" : ""}`
        : "no leads";
  const rk = withRankings && j.rankings && (j.rankings.quality || j.rankings.engagement || j.rankings.conversion) ? ` · Meta rankings: quality ${j.rankings.quality ?? "—"}, engagement ${j.rankings.engagement ?? "—"}, conversion ${j.rankings.conversion ?? "—"}` : "";
  const r = j.read;
  return `${ref} · ${OUTCOME[j.label].label.toUpperCase()} — ${result} · 90 days: ${money(o.spendCents)} spent, ${o.impressions.toLocaleString("en-US")} views, 3-second view rate ${r2(j.hookRate)}, hold ${r2(j.holdRate)}, CTR ${r2(j.ctr)}${rk}
   ${r.format} · ${r.angle} · ${r.presenter} · ${j.media.durationS ?? "?"} s · captions ${r.captions.burnedIn ? "burned in" : "none"} · hook (${r.hook.type}): said "${j.media.hookWords || r.hook.spoken}" / on screen "${r.hook.onScreenText}" / seen: ${r.hook.visual} · offer: ${r.offer || "—"} · proof: ${r.proof.kind}${r.proof.detail ? ` (${r.proof.detail})` : ""} · CTA: ${r.cta.text || "none"}`;
}

interface Pack {
  market: string;
  account: string;
  candidate: string;
  refs: Record<string, EvidenceRef>;
  nearest: NearestAd[];
  nearFrames: { ref: string; path: string }[];
  basis: GradeResult["basis"];
  nearCopyOfDud: boolean;
}

function buildPack(ctx: AccountCtx, cand: { media: ReadMedia; read: CreativeRead }, exclude: Set<string>): Pack {
  const refs: Record<string, EvidenceRef> = {};
  const pool = ctx.all
    .filter((j) => j.label !== "too_little" && !exclude.has(j.readKey))
    .sort((a, b) => b.outcome.spendCents - a.outcome.spendCents)
    .slice(0, POOL_MAX);
  // ── Market ──
  const m = ctx.research;
  const mLines: string[] = [];
  if (m) {
    mLines.push(`MARKET — from Marcel's Ad Library research (${m.age_days} days old):`);
    m.long_running_competitor_ads.forEach((a, i) => {
      const ref = `N${i + 1}`;
      refs[ref] = { kind: "niche", advertiser: a.advertiser, hook: a.hook, daysActive: a.days_active ?? null, url: a.ad_library_url ?? null };
      mLines.push(`${ref} · ${a.advertiser} · ${a.format} · running ${a.days_active ?? "?"} days${a.versions ? `, ${a.versions} versions` : ""} · hook "${a.hook}" · angle ${a.angle} · offer ${a.offer || "—"} · CTA ${a.cta || "—"}`);
    });
    m.market_patterns.forEach((p, i) => {
      const ref = `P${i + 1}`;
      refs[ref] = { kind: "stat", text: `Niche pattern: ${p.title}` };
      mLines.push(`${ref} · pattern: ${p.title} — ${p.detail}`);
    });
    m.gaps.slice(0, 3).forEach((g) => mLines.push(`gap: ${g.title} — ${g.detail}`));
  } else {
    mLines.push("MARKET — no Ad Library research from the last 60 days. Judge freshness against his own videos only.");
  }
  // ── Account ──
  const aLines: string[] = [];
  const near = nearest(
    simOf(cand.read, cand.media),
    pool.map((j) => ({ key: j.readKey, sim: simOf(j.read, j.media), j })),
    3
  );
  const refOf = new Map<string, string>();
  pool.forEach((j, i) => refOf.set(j.readKey, `A${i + 1}`));
  aLines.push(`MARCEL'S VIDEOS — ${pool.length} that ran long enough to judge (last 90 days). Targets: ${money(ctx.tCpb)} per booked call, ${money(ctx.tCpl)} per lead.`);
  pool.forEach((j) => {
    const ref = refOf.get(j.readKey) as string;
    const hookFrame = j.media.frames.find((f) => f.t >= 1)?.path ?? j.media.frames[0]?.path ?? null;
    refs[ref] = { kind: "ad", readKey: j.readKey, name: j.name, adIds: j.adIds, label: j.label, spendCents: j.outcome.spendCents, leads: j.outcome.leads, booked: j.outcome.booked, cplCents: j.cplCents, cpbCents: j.cpbCents, hookRate: j.hookRate, ctr: j.ctr, frame: hookFrame };
    aLines.push(adLine(ref, j, true));
  });
  if (!pool.length) aLines.push("(None of his videos has run long enough to judge yet — say so and judge on craft and the niche.)");
  // Stats
  const prod = pool.filter((j) => produced(j.label));
  const duds = pool.filter((j) => j.label === "dud");
  const stat = (text: string) => {
    const ref = `S${Object.keys(refs).filter((k) => k.startsWith("S")).length + 1}`;
    refs[ref] = { kind: "stat", text };
    aLines.push(`${ref} · ${text}`);
  };
  const med = (xs: (number | null)[]) => median(xs.filter((x): x is number => x !== null));
  if (prod.length && duds.length) {
    stat(`3-second view rate: producing videos ${r2(med(prod.map((j) => j.hookRate)))} (median of ${prod.length}) vs flops ${r2(med(duds.map((j) => j.hookRate)))} (${duds.length})`);
    stat(`CTR: producing ${r2(med(prod.map((j) => j.ctr)))} vs flops ${r2(med(duds.map((j) => j.ctr)))}`);
    stat(`Length: producing ${med(prod.map((j) => j.media.durationS)) ?? "?"} s vs flops ${med(duds.map((j) => j.media.durationS)) ?? "?"} s (medians)`);
    stat(`Burned-in captions: ${prod.filter((j) => j.read.captions.burnedIn).length} of ${prod.length} producing, ${duds.filter((j) => j.read.captions.burnedIn).length} of ${duds.length} flops`);
  } else if (pool.length) {
    stat(`3-second view rate across his videos: median ${r2(med(pool.map((j) => j.hookRate)))}, best ${r2(Math.max(...pool.map((j) => j.hookRate ?? 0)))}`);
  }
  const angleWins = new Map<string, { n: number; p: number }>();
  for (const j of pool) {
    const a = angleWins.get(j.read.angle) ?? { n: 0, p: 0 };
    a.n++;
    if (produced(j.label)) a.p++;
    angleWins.set(j.read.angle, a);
  }
  if (angleWins.size > 1) stat(`By angle: ${[...angleWins.entries()].map(([k, v]) => `${k} ${v.p} of ${v.n} produced`).join(", ")}`);
  // ── Candidate ──
  const c = cand.media;
  const fact = (text: string) => {
    const ref = `F${Object.keys(refs).filter((k) => k.startsWith("F")).length + 1}`;
    refs[ref] = { kind: "fact", text };
    return `${ref} · ${text}`;
  };
  const cLines: string[] = ["THE CANDIDATE"];
  cLines.push(fact(`${c.width ?? "?"}×${c.height ?? "?"}${c.width && c.height ? (c.height > c.width ? " (vertical)" : c.width > c.height * 1.05 ? " (landscape)" : " (square)") : ""}${c.kind === "video" ? `, ${c.durationS ?? "?"} s, ${c.hasAudio ? "with sound" : "no sound"}` : ", a still"}`));
  if (c.kind === "video") {
    cLines.push(fact(c.firstWordAt !== null ? `First word at ${c.firstWordAt} s; said in the first 3 s: "${c.hookWords || "—"}"` : "No words in the first 3 seconds"));
    if (c.wordsPerSec !== null) cLines.push(fact(`Speech pace ${c.wordsPerSec} words per second`));
  }
  const nearestOut: NearestAd[] = near.map((n) => ({ ref: refOf.get(n.key) as string, readKey: n.key, name: n.j.name, label: n.j.label, similarity: n.similarity, frame: (refs[refOf.get(n.key) as string] as { frame: string | null }).frame }));
  if (nearestOut.length) cLines.push(fact(`Closest of his videos: ${nearestOut.map((n) => `${n.ref} (similarity ${n.similarity}, ${OUTCOME[n.label].label})`).join(", ")}`));
  const candSim = simOf(cand.read, cand.media);
  const nearCopyOfDud = pool.some((j) => (j.label === "dud" || j.label === "leads_expensive") && isNearCopy(candSim, simOf(j.read, j.media)));
  cLines.push(`Its read (what's in it, written before any judgment): ${JSON.stringify(cand.read)}`);
  cLines.push(c.words.length ? `Spoken words (seconds):\n${timedLines(c.words, 4000)}` : c.kind === "video" ? "No words could be transcribed." : "");
  for (const f of c.frames) refs[`T${f.t}`] = { kind: "frame", t: f.t };
  return {
    market: mLines.join("\n"),
    account: aLines.join("\n"),
    candidate: cLines.filter(Boolean).join("\n"),
    refs,
    nearest: nearestOut,
    nearFrames: nearestOut.filter((n) => n.frame).map((n) => ({ ref: n.ref, path: n.frame as string })),
    basis: {
      judged: pool.length,
      booked: pool.filter((j) => (j.outcome.booked ?? 0) > 0).length,
      withLeads: pool.filter((j) => j.outcome.leads > 0).length,
      marketAds: m?.long_running_competitor_ads.length ?? 0,
      researchAgeDays: m?.age_days ?? null,
    },
    nearCopyOfDud,
  };
}

/** Grade a read creative against the account (the past video's own look-alikes left out when it's one of his). */
async function gradeWith(ctx: AccountCtx, cand: { media: ReadMedia; read: CreativeRead }, exclude: Set<string>, timeoutMs = 210_000): Promise<{ grade: GradeResult; refs: Record<string, EvidenceRef> }> {
  const pack = buildPack(ctx, cand, exclude);
  const nearUrls = await frameUrls(pack.nearFrames.map((n) => n.path));
  const content: (ImageBlock | TextBlock)[] = [
    { type: "text", text: pack.market, cache_control: { type: "ephemeral" } },
    { type: "text", text: pack.account },
    { type: "text", text: pack.candidate },
    { type: "text", text: "The candidate's stills:" },
    ...(await frameBlocks(cand.media, (t) => `T${t}:`)),
  ];
  for (const n of pack.nearFrames) {
    const url = nearUrls.get(n.path);
    if (!url) continue;
    content.push({ type: "text", text: `${n.ref} at about 1 s (one of his videos, for comparison):` });
    content.push({ type: "image", source: { type: "url", url } });
  }
  content.push({ type: "text", text: "Grade the candidate." });
  const raw = (await structured(
    {
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: GRADE_SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { effort: "high", format: { type: "json_schema", schema: GRADE_SCHEMA } },
    },
    Math.max(60_000, Math.min(210_000, timeoutMs))
  )) as { subscores?: RawSub[]; caps?: { key: CapKey; applies: boolean; why: string; ref: string }[]; fixes?: RawFix[]; fixed_brief?: string; verdict_line?: string; upside?: GradeResult["upside"]; upside_why?: string };

  const valid = new Set(Object.keys(pack.refs));
  const subs = validateEvidence(raw.subscores ?? [], valid);
  const capList: GradeResult["caps"] = [];
  for (const k of codeCaps(cand.media, cand.read)) capList.push({ key: k, label: CAPS[k].label, max: CAPS[k].max, why: k === "wrong_aspect" ? "Meta's feeds and Reels are vertical." : k === "too_long" ? "Over 90 seconds." : "No sound and no burned-in captions." });
  if (pack.nearCopyOfDud) capList.push({ key: "near_copy_of_dud", label: CAPS.near_copy_of_dud.label, max: CAPS.near_copy_of_dud.max, why: "Its script or set-up matches one of your videos that didn't produce." });
  for (const c of raw.caps ?? []) {
    if (!c.applies || !CLAUDE_CAPS.includes(c.key) || !valid.has(String(c.ref).trim()) || capList.some((x) => x.key === c.key)) continue;
    capList.push({ key: c.key, label: CAPS[c.key].label, max: CAPS[c.key].max, why: String(c.why ?? "").slice(0, 240) });
  }
  const capKeys = capList.map((c) => c.key);
  const { raw: rawScore, score } = scoreOf(subs, capKeys);
  const fx = scoreFixes(subs, capKeys, raw.fixes ?? []);
  const conf = confidenceOf(pack.basis);
  return {
    grade: {
      rubricVersion: RUBRIC_VERSION,
      score,
      rawScore,
      band: bandOf(score),
      subs,
      caps: capList,
      fixes: fx.fixes,
      fixedScore: fx.fixedScore,
      fixedBand: bandOf(fx.fixedScore),
      fixedBrief: String(raw.fixed_brief ?? "").slice(0, 2000),
      verdictLine: String(raw.verdict_line ?? "").slice(0, 240),
      upside: raw.upside ?? "medium",
      upsideWhy: String(raw.upside_why ?? "").slice(0, 300),
      nearest: pack.nearest,
      confidence: conf.confidence,
      caveat: conf.caveat,
      basis: pack.basis,
    },
    refs: pack.refs,
  };
}

// ── Grades: uploads, renders, backtest rows ────────────────

export async function gradesToday(ownerId: string, accountId: string): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS n FROM ad_grades
    WHERE owner_id = ${ownerId} AND account_id = ${accountId} AND kind <> 'backtest' AND created_at > now() - interval '24 hours'
  `);
  return Number(rowsOf<{ n: number }>(res)[0]?.n ?? 0);
}

export async function createGrade(o: {
  ownerId: string;
  accountId: string;
  actorId: string;
  kind: "upload" | "render";
  title: string;
  source: { path: string; mime: string } | { projectId: string };
}): Promise<GradeRow> {
  const [row] = await db
    .insert(adGrades)
    .values({ ownerId: o.ownerId, accountId: o.accountId, kind: o.kind, title: o.title.slice(0, 160) || "Untitled creative", source: o.source, createdBy: o.actorId })
    .returning();
  return row;
}

/** A Creative Studio render the owner made (the latest finished edit). */
export async function renderFor(ownerId: string, projectId: string): Promise<{ title: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const [p] = await db
    .select({ id: creativeProjects.id, title: creativeProjects.title })
    .from(creativeProjects)
    .where(and(eq(creativeProjects.id, projectId), eq(creativeProjects.ownerId, ownerId)))
    .limit(1);
  if (!p) return null;
  const [e] = await db
    .select({ id: creativeEdits.id })
    .from(creativeEdits)
    .where(and(eq(creativeEdits.projectId, projectId), eq(creativeEdits.status, "done")))
    .orderBy(desc(creativeEdits.updatedAt))
    .limit(1);
  return e ? { title: p.title || "Creative Studio video" } : null;
}

async function renderUrl(projectId: string): Promise<string | null> {
  const [e] = await db
    .select()
    .from(creativeEdits)
    .where(and(eq(creativeEdits.projectId, projectId), eq(creativeEdits.status, "done")))
    .orderBy(desc(creativeEdits.updatedAt))
    .limit(1);
  if (!e) return null;
  if (e.outputAssetId) {
    const [a] = await db.select({ path: creativeAssets.storagePath }).from(creativeAssets).where(eq(creativeAssets.id, e.outputAssetId)).limit(1);
    if (a?.path) return (await signPaths([a.path], 3600)).get(a.path) ?? null;
  }
  if (e.outputKey && e.renderBucket) {
    const { presignOutput } = await import("@/lib/creative-studio/remotion");
    return presignOutput(e.renderBucket, e.outputKey, 3600).catch(() => null);
  }
  return null;
}

async function claimGrade(id: string): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE ad_grades SET claimed_at = now(), attempts = attempts + 1, updated_at = now()
    WHERE id = ${id} AND status NOT IN ('done', 'failed') AND (claimed_at IS NULL OR claimed_at < ${STALE_CLAIM})
    RETURNING id
  `);
  return rowsOf<{ id: string }>(res).length > 0;
}

/**
 * Carry one grade as far as the time allows: watch → read → grade. Each
 * step is saved, so a later call picks up where this one stopped. `ctx` is
 * shared across a backtest's rows.
 */
export async function advanceGrade(id: string, deadline: number, shared?: { ctx?: Promise<AccountCtx> }): Promise<GradeRow | null> {
  if (!(await claimGrade(id))) return (await db.select().from(adGrades).where(eq(adGrades.id, id)).limit(1))[0] ?? null;
  let [row] = await db.select().from(adGrades).where(eq(adGrades.id, id)).limit(1);
  if (!row) return null;
  const save = async (patch: Partial<typeof adGrades.$inferInsert>) => {
    [row] = await db
      .update(adGrades)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(adGrades.id, id))
      .returning();
  };
  try {
    // Watch
    if (!row.media) {
      if (row.kind === "backtest") {
        const [r] = await db.select().from(adVideoReads).where(and(eq(adVideoReads.ownerId, row.ownerId), eq(adVideoReads.accountId, row.accountId), eq(adVideoReads.readKey, row.readKey ?? ""))).limit(1);
        if (!r?.media || !r.read) throw new MediaError("That past video's read is gone.");
        await save({ media: r.media, read: r.read, status: "grading" });
      } else {
        await save({ status: "watching", error: null });
        const src = row.source as { path?: string; mime?: string; projectId?: string } | null;
        const url = src?.path ? ((await signPaths([src.path], 3600)).get(src.path) ?? null) : src?.projectId ? await renderUrl(src.projectId) : null;
        if (!url) throw new MediaError("Couldn't open the file — upload it again.");
        const prefix = `adgrade/${row.ownerId}/grades/${row.id}`;
        const media = src?.mime?.startsWith("image/") ? await watchStill(url, prefix, "image") : await watchVideo(url, prefix, { deadline: deadline - 15_000 });
        await save({ media, status: "reading" });
      }
    }
    if (Date.now() > deadline - 60_000) return release(row);
    // Read
    if (!row.read) {
      await save({ status: "reading" });
      const read = await readCreative(row.media as ReadMedia);
      await save({ read, status: "grading" });
    }
    if (Date.now() > deadline - 170_000) return release(row);
    // Grade
    await save({ status: "grading" });
    const ctx = await (shared?.ctx ?? accountContext(row.ownerId, row.accountId));
    let exclude = new Set<string>();
    if (row.kind === "backtest" && row.readKey) {
      const clusters = conceptClusters(ctx.all.map((j) => ({ key: j.readKey, videoId: j.videoId, text: j.media.text, hookWords: j.media.hookWords })));
      const mine = clusters.get(row.readKey) ?? row.readKey;
      exclude = new Set([...clusters.entries()].filter(([, c]) => c === mine).map(([k]) => k));
      exclude.add(row.readKey);
    }
    const out = await gradeWith(ctx, { media: row.media as ReadMedia, read: row.read as CreativeRead }, exclude, deadline - Date.now() - 15_000);
    await save({ grade: out.grade, evidence: out.refs, rubricVersion: RUBRIC_VERSION, status: "done", error: null, claimedAt: null });
    return row;
  } catch (err) {
    const msg = err instanceof MediaError ? err.message : errText(err);
    console.error("[ads grader] grade failed:", id, msg);
    const final = err instanceof MediaError || row.attempts >= 3;
    await save({ status: final ? "failed" : row.status, error: final ? msg : `Retrying — ${msg}`, claimedAt: null });
    return row;
  }
}

async function release(row: GradeRow): Promise<GradeRow> {
  const [r] = await db.update(adGrades).set({ claimedAt: null, updatedAt: new Date() }).where(eq(adGrades.id, row.id)).returning();
  return r ?? row;
}

export async function retryGrade(ownerId: string, id: string): Promise<boolean> {
  const res = await db
    .update(adGrades)
    .set({ status: "queued", attempts: 0, error: null, claimedAt: null, updatedAt: new Date() })
    .where(and(eq(adGrades.id, id), eq(adGrades.ownerId, ownerId), eq(adGrades.status, "failed")))
    .returning({ id: adGrades.id });
  return res.length > 0;
}

export async function deleteGrade(ownerId: string, id: string): Promise<boolean> {
  const [row] = await db.select().from(adGrades).where(and(eq(adGrades.id, id), eq(adGrades.ownerId, ownerId))).limit(1);
  if (!row || row.kind === "backtest") return false;
  const media = row.media as ReadMedia | null;
  const src = row.source as { path?: string } | null;
  await removePaths([...(media?.frames ?? []).map((f) => f.path), src?.path ?? null]);
  await db.delete(adGrades).where(eq(adGrades.id, id));
  return true;
}

export async function linkGrade(ownerId: string, accountId: string, id: string, adIds: string[]): Promise<boolean> {
  const known = await cachedAdCreatives(ownerId, accountId);
  const ids = [...new Set(adIds.filter((a) => known.has(a)))].slice(0, 10);
  const res = await db
    .update(adGrades)
    .set({ linkedAdIds: ids, linkSource: "manual", linkedAt: ids.length ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(adGrades.id, id), eq(adGrades.ownerId, ownerId), ne(adGrades.kind, "backtest")))
    .returning({ id: adGrades.id });
  return res.length > 0;
}

// ── The blind backtest ─────────────────────────────────────

export async function startBacktest(ownerId: string, accountId: string, actorId: string | null, opts: { auto?: boolean } = {}): Promise<{ total: number }> {
  const [last] = await db
    .select()
    .from(adGraderRuns)
    .where(and(eq(adGraderRuns.ownerId, ownerId), eq(adGraderRuns.accountId, accountId), eq(adGraderRuns.kind, "backtest")))
    .orderBy(desc(adGraderRuns.createdAt))
    .limit(1);
  if (last?.status === "running") throw new Error("A backtest is already running.");
  if (last && last.rubricVersion === RUBRIC_VERSION && last.createdAt.getTime() > Date.now() - 24 * 3600_000) {
    if (opts.auto) return { total: 0 };
    throw new Error("The grader was checked in the last day — try again tomorrow.");
  }
  const ctx = await accountContext(ownerId, accountId);
  const judged = ctx.all.filter((j) => j.label !== "too_little" && j.media.quality !== "still_only");
  if (judged.length < BACKTEST_MIN) {
    if (opts.auto) return { total: 0 };
    throw new Error(`Only ${judged.length} of your videos ran long enough to judge — the check needs ${BACKTEST_MIN}.`);
  }
  const [run] = await db
    .insert(adGraderRuns)
    .values({ ownerId, accountId, kind: "backtest", total: judged.length, rubricVersion: RUBRIC_VERSION, startedBy: actorId })
    .onConflictDoNothing()
    .returning();
  if (!run) throw new Error("A backtest is already running.");
  await db.insert(adGrades).values(judged.map((j) => ({ ownerId, accountId, kind: "backtest" as const, runId: run.id, readKey: j.readKey, title: j.name, status: "queued" as const })));
  return { total: judged.length };
}

/** Grade backtest rows (3 at a time) until the deadline; scores the run when they're all in. */
export async function advanceBacktest(ownerId: string, accountId: string, deadline: number): Promise<{ left: number } | null> {
  const [run] = await db
    .select()
    .from(adGraderRuns)
    .where(and(eq(adGraderRuns.ownerId, ownerId), eq(adGraderRuns.accountId, accountId), eq(adGraderRuns.kind, "backtest"), eq(adGraderRuns.status, "running")))
    .limit(1);
  if (!run) return null;
  const ctx = accountContext(ownerId, accountId);
  const pending = async () =>
    db
      .select({ id: adGrades.id })
      .from(adGrades)
      .where(and(eq(adGrades.runId, run.id), inArray(adGrades.status, ["queued", "watching", "reading", "grading"])))
      .limit(30);
  const taken = new Set<string>();
  const worker = async () => {
    while (Date.now() < deadline - 180_000) {
      const next = (await pending()).find((r) => !taken.has(r.id));
      if (!next) return;
      taken.add(next.id);
      await advanceGrade(next.id, deadline, { ctx });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const left = (await pending()).length;
  if (left === 0) {
    const rows = await db.select().from(adGrades).where(and(eq(adGrades.runId, run.id), eq(adGrades.status, "done")));
    const c = await ctx;
    const byKey = new Map(c.all.map((j) => [j.readKey, j]));
    const record = trackRecord(
      rows
        .map((r) => {
          const j = byKey.get(r.readKey ?? "");
          const g = r.grade as GradeResult | null;
          return j && g ? { name: j.name, score: g.score, label: j.label, spendCents: j.outcome.spendCents } : null;
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
    );
    await db.update(adGraderRuns).set({ status: "done", summary: record, finishedAt: new Date(), updatedAt: new Date() }).where(eq(adGraderRuns.id, run.id));
  }
  return { left };
}

// ── What the page shows ────────────────────────────────────

async function liveFor(ids: string[], s: AdsSnapshot | null, t: { cpbCents: number; cplCents: number }): Promise<LiveResult | null> {
  if (!ids.length || !s) return null;
  const ads = s.ads.filter((a) => ids.includes(a.id));
  if (!ads.length) return null;
  const plan = decideAds(s);
  const o: Outcome = { spendCents: 0, impressions: 0, linkClicks: 0, views3s: 0, thruplays: 0, leads: 0, booked: null };
  for (const a of ads) {
    const m = a.l30 ?? a.metrics.cur;
    const crm = m.ghlLeads !== null && a.creative.hasUtmContent !== false;
    o.spendCents += m.spendCents;
    o.impressions += m.impressions;
    o.linkClicks += m.linkClicks;
    o.views3s += m.videoViews3s;
    o.thruplays += m.thruplays;
    o.leads += crm ? (m.ghlLeads ?? 0) : m.metaLeads;
    if (crm) o.booked = (o.booked ?? 0) + (m.booked ?? 0);
  }
  const call = plan.calls.find((c) => ids.includes(c.adId));
  return {
    adIds: ads.map((a) => a.id),
    names: ads.map((a) => a.name),
    spendCents: o.spendCents,
    impressions: o.impressions,
    hookRate: o.impressions && o.views3s ? o.views3s / o.impressions : null,
    ctr: o.impressions ? o.linkClicks / o.impressions : null,
    leads: o.leads,
    booked: o.booked,
    label: outcomeLabel(o, t),
    call: call ? (call.call === "cut" ? (call.cutKind === "early_read" ? "Cut · early read" : "Cut") : `Keep · ${call.tag}`) : null,
    rankings: ads[0].rankings,
  };
}

export async function graderState(ownerId: string, accountId: string): Promise<GraderState> {
  const settings = await getSettings(ownerId, accountId);
  const [reads, runs, rows, today, creatives] = await Promise.all([
    db
      .select({ status: adVideoReads.status, media: adVideoReads.media, readKey: adVideoReads.readKey, updatedAt: adVideoReads.updatedAt })
      .from(adVideoReads)
      .where(and(eq(adVideoReads.ownerId, ownerId), eq(adVideoReads.accountId, accountId))),
    db
      .select()
      .from(adGraderRuns)
      .where(and(eq(adGraderRuns.ownerId, ownerId), eq(adGraderRuns.accountId, accountId)))
      .orderBy(desc(adGraderRuns.createdAt))
      .limit(10),
    db
      .select()
      .from(adGrades)
      .where(and(eq(adGrades.ownerId, ownerId), eq(adGrades.accountId, accountId), ne(adGrades.kind, "backtest"), gte(adGrades.createdAt, new Date(Date.now() - 120 * 86_400_000))))
      .orderBy(desc(adGrades.createdAt))
      .limit(30),
    gradesToday(ownerId, accountId),
    cachedAdCreatives(ownerId, accountId).catch(() => new Map()),
  ]);
  // The 30-day numbers only when a grade is tied to a live ad.
  const r30 = rows.some((r) => ((r.linkedAdIds as string[] | null) ?? []).length)
    ? await buildAdsSnapshot({ ownerId, accountId, range: "30", targets: { cpbCents: settings.targetCpbCents, cplCents: settings.targetCplCents, monthlyBudgetCents: settings.monthlyBudgetCents }, budgetMs: 40_000 }).catch(() => null)
    : null;
  const s30 = r30 && r30.configured ? r30.snapshot : null;
  const t = { cpbCents: s30?.targetCpb.cents ?? settings.targetCpbCents ?? 30000, cplCents: s30?.targetCpl?.cents ?? Math.round((settings.targetCpbCents ?? 30000) / 3) };
  const learnRun = runs.find((r) => r.kind === "learn");
  const btRun = runs.find((r) => r.kind === "backtest");
  const count = (st: string) => reads.filter((r) => r.status === st).length;
  const open = reads.filter((r) => r.status === "queued" || r.status === "reading").length;
  const btRows = btRun ? await db.select({ status: adGrades.status }).from(adGrades).where(eq(adGrades.runId, btRun.id)) : [];
  const judgedNow = reads.filter((r) => r.status === "done").length;

  // Sign every frame the page shows (thumbs, nearest, evidence frames).
  const paths: string[] = [];
  for (const r of rows) {
    const m = r.media as ReadMedia | null;
    const thumb = m?.frames.find((f) => f.t >= 0.5) ?? m?.frames[0];
    if (thumb) paths.push(thumb.path);
    const g = r.grade as GradeResult | null;
    for (const n of g?.nearest ?? []) if (n.frame) paths.push(n.frame);
    for (const e of Object.values((r.evidence as Record<string, EvidenceRef> | null) ?? {})) if (e.kind === "ad" && e.frame) paths.push(e.frame);
  }
  const signed = await signPaths(paths, 6 * 3600);
  const videoAds = [...creatives.entries()].map(([id, c]) => ({ id, name: c.name, createdTime: c.createdTime, mediaType: c.mediaType }));
  const grades: GradeView[] = await Promise.all(
    rows.map(async (r) => {
      const m = r.media as ReadMedia | null;
      const g = r.grade as GradeResult | null;
      const ev = (r.evidence as Record<string, EvidenceRef> | null) ?? {};
      const thumb = m?.frames.find((f) => f.t >= 0.5) ?? m?.frames[0];
      const ids = (r.linkedAdIds as string[] | null) ?? [];
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        status: r.status,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
        durationS: m?.durationS ?? null,
        thumb: thumb ? (signed.get(thumb.path) ?? null) : null,
        grade: g,
        refs: Object.fromEntries(Object.entries(ev).map(([k, e]) => [k, e.kind === "ad" ? { ...e, frameUrl: e.frame ? (signed.get(e.frame) ?? null) : null } : e])),
        nearest: (g?.nearest ?? []).map((n) => ({ ...n, frameUrl: n.frame ? (signed.get(n.frame) ?? null) : null })),
        linked: await liveFor(ids, s30, t),
        suggestions: ids.length || r.status !== "done" ? [] : suggestLinks({ title: r.title, createdAt: r.createdAt.toISOString() }, videoAds).map((x) => ({ id: x.id, name: x.name })),
      } satisfies GradeView;
    })
  );
  // Live track record: graded creatives that ran.
  const liveItems = grades
    .filter((g) => g.grade && g.linked && g.linked.label !== "too_little")
    .map((g) => ({ name: g.title, score: (g.grade as GradeResult).score, label: (g.linked as LiveResult).label, spendCents: (g.linked as LiveResult).spendCents }));
  const live: TrackRecord | null = liveItems.length >= 3 ? trackRecord(liveItems) : null;
  return {
    learn: {
      status: learnRun?.status === "running" || open > 0 ? "running" : reads.length ? "done" : "never",
      total: reads.length,
      done: count("done") + count("partial"),
      failed: reads.filter((r) => r.status === "unavailable" || r.status === "failed").length,
      partial: count("partial"),
      judged: judgedNow,
      updatedAt: learnRun?.updatedAt.toISOString() ?? null,
    },
    backtest: btRun
      ? {
          status: btRun.status,
          total: btRun.total,
          done: btRows.filter((r) => r.status === "done" || r.status === "failed").length,
          record: (btRun.summary as TrackRecord | null) ?? null,
          finishedAt: btRun.finishedAt?.toISOString() ?? null,
          newSince: Math.max(0, judgedNow - btRun.total),
        }
      : null,
    live,
    grades,
    today,
    dailyCap: GRADE_DAILY_CAP,
  };
}

/** The grader in a few lines, for the Ask chat. */
export async function gradesForChat(ownerId: string, accountId: string) {
  const [rows, bt] = await Promise.all([
    db
      .select()
      .from(adGrades)
      .where(and(eq(adGrades.ownerId, ownerId), eq(adGrades.accountId, accountId), ne(adGrades.kind, "backtest"), eq(adGrades.status, "done")))
      .orderBy(desc(adGrades.createdAt))
      .limit(8),
    db
      .select()
      .from(adGraderRuns)
      .where(and(eq(adGraderRuns.ownerId, ownerId), eq(adGraderRuns.accountId, accountId), eq(adGraderRuns.kind, "backtest"), eq(adGraderRuns.status, "done")))
      .orderBy(desc(adGraderRuns.createdAt))
      .limit(1),
  ]);
  const record = (bt[0]?.summary as TrackRecord | null) ?? null;
  return {
    how_it_grades: "Out of 100 against Marcel's own videos' 90-day results and long-running niche ads; every line must cite evidence; hard caps for e.g. no captions or near-copies of flops. 70+ Run it, 50-69 Fix first, under 50 Don't spend.",
    blind_check: record ? { verdict: record.verdict, summary: record.verdictText, videos: record.n, rank_match: record.rho } : "not run yet",
    recent_grades: rows.map((r) => {
      const g = r.grade as GradeResult;
      return {
        title: r.title,
        graded: r.createdAt.toISOString().slice(0, 10),
        score: g.score,
        verdict: BAND[g.band].label,
        line: g.verdictLine,
        caps: g.caps.map((c) => `${c.label} (max ${c.max})`),
        weakest: [...g.subs].sort((a, b) => a.score - b.score).slice(0, 2).map((s) => `${s.label} ${s.score}/10: ${s.why}`),
        fixes: g.fixes.slice(0, 3).map((f) => `${f.title} (+${f.points})`),
        fixed_version_score: g.fixedScore,
        linked_live_ad_ids: (r.linkedAdIds as string[] | null) ?? [],
      };
    }),
  };
}

/** Continue whatever is in flight (the cron's slice): learning, the backtest, stale grades. */
export async function graderCron(ownerId: string, accountId: string, deadline: number): Promise<void> {
  const [learnRun] = await db
    .select()
    .from(adGraderRuns)
    .where(and(eq(adGraderRuns.ownerId, ownerId), eq(adGraderRuns.accountId, accountId), eq(adGraderRuns.kind, "learn")))
    .orderBy(desc(adGraderRuns.createdAt))
    .limit(1);
  if (learnRun) {
    // Once a day after the first learn: pick up new videos worth learning from.
    if (learnRun.status === "done" && learnRun.createdAt.getTime() < Date.now() - 24 * 3600_000) {
      await planLearn(ownerId, accountId, null).catch((err) => console.warn("[ads grader] daily learn:", errText(err)));
    }
    if ((await openReads(ownerId, accountId)) > 0) {
      await advanceLearn(ownerId, accountId, deadline);
      return;
    }
    if (Date.now() < deadline - 170_000) await advanceBacktest(ownerId, accountId, deadline);
  }
  // Grades left half-done (the page closed): finish them.
  const stale = await db
    .select({ id: adGrades.id })
    .from(adGrades)
    .where(and(eq(adGrades.ownerId, ownerId), eq(adGrades.accountId, accountId), ne(adGrades.kind, "backtest"), inArray(adGrades.status, ["queued", "watching", "reading", "grading"]), gte(adGrades.createdAt, new Date(Date.now() - 86_400_000))))
    .limit(2);
  for (const g of stale) if (Date.now() < deadline - 170_000) await advanceGrade(g.id, deadline);
}

export { BAND, RUBRIC };
/** For tests: the evidence pack builder. */
export const _buildPackForTest = buildPack;
export const _gradeWithForTest = gradeWith;
export type { AccountCtx as _AccountCtx, Judged as _Judged };
