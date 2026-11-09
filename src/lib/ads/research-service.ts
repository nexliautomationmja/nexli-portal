import sharp from "sharp";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { adAnalyses } from "@/lib/ads/tables";
import { snapshot30 } from "@/lib/ads/pack";
import { getAdCreativesMeta } from "@/lib/meta-ads";
import { writeStorage } from "@/lib/creative-studio/frames";
import { signPaths } from "@/lib/creative-studio/storage";
import { listTaskMessages } from "@/lib/creative-studio/manus";
import { notifyResearchReady } from "@/lib/ads/notify";
import { AD_LIBRARY_CONNECTOR, activeRun, analysisView, attachmentsOf, b64, cachedConnector, errMsg, latestDone, setRun, type AnalysisRow, type AnalysisView, type Attachment, type RunSpec } from "@/lib/ads/runs";
import { buildResearchPack, researchIndex, researchPackSummary, type ResearchPack, type ResearchPackSummary, type Still } from "@/lib/ads/research-pack";
import { RESEARCH_AUTO_REPLY, RESEARCH_PLAYBOOK_VERSION, researchPlaybookMarkdown, researchPromptText } from "@/lib/ads/research-playbook";
import { RESEARCH_SCHEMA, RESEARCH_SCHEMA_VERSION } from "@/lib/ads/research-schema";
import { matchScreenshots, parseResearch, type ParsedResearch, type ResearchAd } from "@/lib/ads/research-parse";
import type { ParsedAnalysis } from "@/lib/ads/parse";
import { localDate } from "@/lib/ads/time";

/**
 * Ad Library research runs on the shared Manus engine (analysis-service.ts).
 * Build: the research pack. Inputs: prompt + pack + playbook (+ our stills),
 * the Ad Library connector if one is installed in Manus. Save: download the
 * screenshots Manus attached right away (its links are temporary), store
 * them privately, then done + the ready alert.
 */

interface StoredResearch {
  pack: ResearchPack;
  stills: Still[];
}

export type ResearchResult = Omit<ParsedResearch, "reportMarkdown">;

const MAX_SHOTS = 30;
const MAX_SHOT_BYTES = 25 * 1024 * 1024;

/** Full-size stills of our top ads for Manus (Meta's own posters, 20 s at most; thumbnails otherwise). */
async function postersFor(adIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!adIds.length) return out;
  const meta = await Promise.race([getAdCreativesMeta(adIds.slice(0, 6)), new Promise<null>((r) => setTimeout(() => r(null), 20_000))]).catch(() => null);
  if (meta && meta.ok) for (const [id, m] of Object.entries(meta.byId)) if (m.posterUrl) out.set(id, m.posterUrl);
  return out;
}

async function storeScreenshots(runId: string, matches: Map<string, string>, deadline: number): Promise<Map<string, { path: string; w: number; h: number }>> {
  const stored = new Map<string, { path: string; w: number; h: number }>();
  const jobs = [...matches.entries()];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, jobs.length) }, async () => {
      while (next < jobs.length) {
        const [ref, url] = jobs[next++];
        if (Date.now() > deadline - 12_000) return;
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 20_000);
          const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
          if (!res.ok) throw new Error(`download ${res.status}`);
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > MAX_SHOT_BYTES) continue;
          const out = await sharp(buf, { failOn: "none" })
            .rotate()
            .resize({ width: 1080, height: 3200, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 84, mozjpeg: true })
            .toBuffer({ resolveWithObject: true });
          const path = `ads-research/${runId}/${ref}.jpg`;
          await writeStorage(path, out.data, "image/jpeg");
          stored.set(ref, { path, w: out.info.width, h: out.info.height });
        } catch (err) {
          console.warn(`[ads] research screenshot ${ref} failed:`, errMsg(err));
        }
      }
    })
  );
  return stored;
}

export const RESEARCH_SPEC: RunSpec<ParsedResearch> = {
  kind: "research",
  maxRunMs: 120 * 60_000,
  autoReply: RESEARCH_AUTO_REPLY,
  jsonName: /ads-research\.json$/i,
  async build(r, settings) {
    const s30 = await snapshot30(r.ownerId, r.accountId, settings);
    if (!s30) return { fail: "Meta ads aren't connected (META_ADS_ACCESS_TOKEN / META_AD_ACCOUNT_ID)." };
    const [analysis, previous] = await Promise.all([latestDone(r.ownerId, r.accountId, "analysis"), latestDone(r.ownerId, r.accountId, "research")]);
    const topIds = s30.ads
      .filter((a) => a.effectiveStatus === "ACTIVE" || (a.l30?.spendCents ?? 0) > 0)
      .sort((a, b) => (b.l30?.spendCents ?? 0) - (a.l30?.spendCents ?? 0))
      .slice(0, 6)
      .map((a) => a.id);
    const posters = await postersFor(topIds).catch(() => new Map<string, string>());
    const built = buildResearchPack({
      s30,
      settings,
      analysis: analysis ? { finishedAt: analysis.finishedAt, result: (analysis.result as Omit<ParsedAnalysis, "reportMarkdown"> | null) ?? null } : null,
      previous: previous ? { finishedAt: previous.finishedAt, result: (previous.result as ParsedResearch | null) ?? null } : null,
      posters,
    });
    return {
      dataPack: { pack: built.pack, stills: built.stills } satisfies StoredResearch,
      patch: { throughDate: built.pack.today, timezone: s30.account.timezone, playbookVersion: RESEARCH_PLAYBOOK_VERSION, schemaVersion: RESEARCH_SCHEMA_VERSION },
    };
  },
  async inputs(r, settings) {
    const stored = r.dataPack as StoredResearch;
    const connector = await cachedConnector(settings, "libraryConnector", AD_LIBRARY_CONNECTOR, null, "Ad Library");
    return {
      prompt: researchPromptText({ today: stored.pack.today, stills: stored.stills.length, hasConnector: Boolean(connector), competitors: stored.pack.competitors_to_check.length }),
      files: [
        { data: b64(JSON.stringify(stored.pack)), filename: "research-pack.json", mimeType: "application/json" },
        { data: b64(researchPlaybookMarkdown()), filename: "research-playbook.md", mimeType: "text/markdown" },
      ],
      optionalFiles: stored.stills,
      title: `Nexli Ads · Ad Library research · ${stored.pack.today}`,
      schema: RESEARCH_SCHEMA as unknown as Record<string, unknown>,
      connector,
    };
  },
  parser(r) {
    const stored = r.dataPack as StoredResearch | null;
    if (!stored?.pack) return null;
    const idx = researchIndex(stored.pack);
    return (v) => parseResearch(v, idx);
  },
  reportOf: (p) => p.reportMarkdown,
  async save(claimed, parsed, ctx) {
    if (!parsed.ads.length && !parsed.briefs.length) {
      return setRun(claimed.id, { status: "failed", activity: ctx.activity, waiting: null, error: `Manus couldn't collect any ads${parsed.dataNotes[0] ? `: ${parsed.dataNotes[0]}` : "."}`.slice(0, 500) });
    }
    // Screenshots: Manus's links are temporary, so copy them now.
    let attachments: Attachment[] = attachmentsOf(ctx.messages);
    if (claimed.manusTaskId) {
      try {
        const more = attachmentsOf(await listTaskMessages(claimed.manusTaskId, { verbose: false, limit: 100, order: "desc" }));
        const seen = new Set(attachments.map((a) => a.uid));
        attachments = [...attachments, ...more.filter((a) => !seen.has(a.uid))];
      } catch (err) {
        console.warn("[ads] listing research attachments failed:", errMsg(err));
      }
    }
    const matches = matchScreenshots(parsed.ads, attachments, MAX_SHOTS);
    const stored = await storeScreenshots(claimed.id, matches, ctx.deadline);
    const { reportMarkdown: _omit, ...rest } = parsed;
    void _omit;
    const result: ResearchResult = {
      ...rest,
      ads: parsed.ads.map((a) => ({ ...a, screenshot: stored.get(a.ref) ?? null })),
      screenshots: { found: stored.size, expected: parsed.ads.length },
    };
    const done = await setRun(claimed.id, {
      status: "done",
      result,
      reportMd: ctx.report || null,
      headline: parsed.headline.slice(0, 300),
      finishedAt: new Date(),
      activity: ctx.activity,
      waiting: null,
      error: null,
    });
    await notifyResearchReady(done).catch((err) => console.warn("[ads] research ready alert failed:", errMsg(err)));
    return done;
  },
};

// ── Views ───────────────────────────────────────────────

export interface ResearchAdView extends ResearchAd {
  screenshotUrl: string | null;
}

export interface ResearchView {
  id: string;
  createdAt: string;
  finishedAt: string | null;
  seen: boolean;
  taskUrl: string | null;
  hasReport: boolean;
  headline: string | null;
  result: Omit<ResearchResult, "ads"> & { ads: ResearchAdView[] };
}

export async function researchView(row: AnalysisRow): Promise<ResearchView | null> {
  const result = row.result as ResearchResult | null;
  if (!result || row.status !== "done") return null;
  const signed = await signPaths(result.ads.map((a) => a.screenshot?.path), 12 * 3600);
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    seen: Boolean(row.seenAt),
    taskUrl: row.taskUrl,
    hasReport: Boolean(row.reportMd),
    headline: row.headline,
    result: { ...result, ads: result.ads.map((a) => ({ ...a, screenshotUrl: a.screenshot?.path ? (signed.get(a.screenshot.path) ?? null) : null })) },
  };
}

export interface ResearchSummaryRow {
  id: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  headline: string | null;
  error: string | null;
  ads: number;
  briefs: number;
}

/** The research side of the Ads tab: the run in flight, the latest findings, earlier runs. */
export async function researchState(ownerId: string, accountId: string): Promise<{ active: AnalysisView | null; latest: ResearchView | null; history: ResearchSummaryRow[] }> {
  const [active, latest, history] = await Promise.all([
    activeRun(ownerId, accountId, "research"),
    latestDone(ownerId, accountId, "research"),
    db
      .select({
        id: adAnalyses.id,
        status: adAnalyses.status,
        createdAt: adAnalyses.createdAt,
        finishedAt: adAnalyses.finishedAt,
        headline: adAnalyses.headline,
        error: adAnalyses.error,
        ads: sql<number>`CASE WHEN jsonb_typeof(${adAnalyses.result}->'ads') = 'array' THEN jsonb_array_length(${adAnalyses.result}->'ads') ELSE 0 END`,
        briefs: sql<number>`CASE WHEN jsonb_typeof(${adAnalyses.result}->'briefs') = 'array' THEN jsonb_array_length(${adAnalyses.result}->'briefs') ELSE 0 END`,
      })
      .from(adAnalyses)
      .where(and(eq(adAnalyses.ownerId, ownerId), eq(adAnalyses.accountId, accountId), eq(adAnalyses.kind, "research"), inArray(adAnalyses.status, ["done", "failed", "stopped"])))
      .orderBy(desc(adAnalyses.createdAt))
      .limit(10),
  ]);
  return {
    active: active ? analysisView(active) : null,
    latest: latest ? await researchView(latest) : null,
    history: history.map((h) => ({
      id: h.id,
      status: h.status,
      createdAt: h.createdAt.toISOString(),
      finishedAt: h.finishedAt?.toISOString() ?? null,
      headline: h.headline,
      error: h.error,
      ads: Number(h.ads) || 0,
      briefs: Number(h.briefs) || 0,
    })),
  };
}

/** One research run (for the report viewer and "earlier research"). */
export async function researchDetail(row: AnalysisRow) {
  return { analysis: analysisView(row), report: row.reportMd, steps: [], research: await researchView(row) };
}

/** The latest research (last 60 days) for the weekly analysis's data pack. */
export async function latestResearchForPack(ownerId: string, accountId: string): Promise<ResearchPackSummary | null> {
  const row = await latestDone(ownerId, accountId, "research");
  if (!row) return null;
  return researchPackSummary(row.finishedAt, (row.result as ParsedResearch | null) ?? null, localDate(new Date(), row.timezone || "America/Chicago"));
}
