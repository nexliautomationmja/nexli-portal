import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { adAnalyses, adSettings, ACTIVE_ANALYSIS, type AnalysisStatus, type RunKind } from "@/lib/ads/tables";
import type { AdSettingsRow } from "@/lib/ads/settings";
import type { ParsedAnalysis } from "@/lib/ads/parse";
import { listConnectors, type ManusFile, type ManusMessage } from "@/lib/creative-studio/manus";

/**
 * The shared pieces of a Manus run (an account analysis or Ad Library
 * research): row helpers, the save claim, reading Manus's structured result
 * and attachments, connector lookup, and the per-kind spec the engine in
 * analysis-service.ts follows. No transactions on Neon HTTP — every
 * transition is a conditional UPDATE.
 */

export type AnalysisRow = typeof adAnalyses.$inferSelect;

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string } | null;
  return e?.code === "23505" || e?.cause?.code === "23505" || /duplicate key|unique constraint/i.test(e?.message ?? "");
}

export const setRun = (id: string, patch: Partial<AnalysisRow>) =>
  db
    .update(adAnalyses)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(adAnalyses.id, id))
    .returning()
    .then((r) => r[0]);

export async function loadRun(ownerId: string, id: string): Promise<AnalysisRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(adAnalyses).where(and(eq(adAnalyses.id, id), eq(adAnalyses.ownerId, ownerId))).limit(1);
  return row ?? null;
}

export async function activeRun(ownerId: string, accountId: string, kind: RunKind): Promise<AnalysisRow | null> {
  const [row] = await db
    .select()
    .from(adAnalyses)
    .where(and(eq(adAnalyses.ownerId, ownerId), eq(adAnalyses.accountId, accountId), eq(adAnalyses.kind, kind), inArray(adAnalyses.status, ACTIVE_ANALYSIS)))
    .orderBy(desc(adAnalyses.createdAt))
    .limit(1);
  return row ?? null;
}

export async function latestDone(ownerId: string, accountId: string, kind: RunKind): Promise<AnalysisRow | null> {
  const [row] = await db
    .select()
    .from(adAnalyses)
    .where(and(eq(adAnalyses.ownerId, ownerId), eq(adAnalyses.accountId, accountId), eq(adAnalyses.kind, kind), eq(adAnalyses.status, "done")))
    .orderBy(desc(adAnalyses.finishedAt))
    .limit(1);
  return row ?? null;
}

/** Claim the save (running/waiting → saving) so two pollers never save twice. */
export async function claimSave(row: AnalysisRow): Promise<AnalysisRow | null> {
  const [claimed] = await db
    .update(adAnalyses)
    .set({ status: "saving" as AnalysisStatus, updatedAt: new Date() })
    .where(and(eq(adAnalyses.id, row.id), inArray(adAnalyses.status, ["running", "waiting"])))
    .returning();
  return claimed ?? null;
}

export const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

export function structuredOf(messages: ManusMessage[]): { success: boolean; value: unknown; error: string | null } | null {
  for (const m of messages) {
    const r = m.structured_output_result;
    if ((m.type === "structured_output_result" || r) && r) return { success: Boolean(r.success), value: r.value, error: r.error ?? null };
  }
  return null;
}

export interface Attachment {
  filename: string;
  url: string;
  contentType: string;
  uid: string;
}

/** Every file Manus attached, newest first (messages come newest first), each once. */
export function attachmentsOf(messages: ManusMessage[]): Attachment[] {
  const out: Attachment[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    for (const a of m.assistant_message?.attachments ?? []) {
      if (!a.url) continue;
      const uid = String(a.file_uid ?? a.url);
      if (seen.has(uid)) continue;
      seen.add(uid);
      out.push({ filename: a.filename ?? "", url: a.url, contentType: String(a.content_type ?? a.type ?? ""), uid });
    }
  }
  return out;
}

/** Manus's attached JSON answer: files named like `prefer` first, then any .json. */
export async function attachedJson(messages: ManusMessage[], prefer: RegExp): Promise<unknown> {
  const files = attachmentsOf(messages).filter((a) => /\.json$/i.test(a.filename));
  const ordered = [...files.filter((a) => prefer.test(a.filename)), ...files.filter((a) => !prefer.test(a.filename))];
  for (const a of ordered) {
    try {
      const res = await fetch(a.url);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("[ads] reading Manus's JSON attachment failed:", errMsg(err));
    }
  }
  return null;
}

export const META_ADS_CONNECTOR = /meta\s*ads|ads\s*manager|facebook\s*ads/i;
export const AD_LIBRARY_CONNECTOR = /ads?\s*library|ads?\s*archive/i;

/**
 * A Manus connector matching `match` (and not `exclude`), cached on the
 * settings row for 24 hours. Never throws.
 */
export async function cachedConnector(
  settings: AdSettingsRow,
  column: "manusConnector" | "libraryConnector",
  match: RegExp,
  exclude: RegExp | null,
  fallbackName: string
): Promise<{ id: string; name: string } | null> {
  const cached = settings[column];
  if (cached && Date.now() - new Date(cached.checkedAt).getTime() < 24 * 3600 * 1000) return cached.id ? { id: cached.id, name: cached.name ?? fallbackName } : null;
  try {
    const list = await listConnectors();
    const hit =
      list.find((c) => {
        const text = `${c.name} ${c.description ?? ""}`;
        return match.test(text) && !(exclude && exclude.test(text));
      }) ?? null;
    const value = { id: hit?.id ?? null, name: hit?.name ?? null, checkedAt: new Date().toISOString() };
    await db
      .update(adSettings)
      .set(column === "manusConnector" ? { manusConnector: value } : { libraryConnector: value })
      .where(and(eq(adSettings.ownerId, settings.ownerId), eq(adSettings.accountId, settings.accountId)));
    return hit ? { id: hit.id, name: hit.name } : null;
  } catch (err) {
    console.warn("[ads] Manus connector lookup failed:", errMsg(err));
    return cached?.id ? { id: cached.id, name: cached.name ?? fallbackName } : null;
  }
}

/** What each kind of run plugs into the shared engine. */
export interface RunSpec<P> {
  kind: RunKind;
  maxRunMs: number;
  autoReply: string;
  /** Preferred name of the JSON copy Manus attaches. */
  jsonName: RegExp;
  build(row: AnalysisRow, settings: AdSettingsRow): Promise<{ dataPack: unknown; patch: Partial<AnalysisRow> } | { fail: string }>;
  inputs(
    row: AnalysisRow,
    settings: AdSettingsRow
  ): Promise<{ prompt: string; files: ManusFile[]; optionalFiles: ManusFile[]; title: string; schema: Record<string, unknown>; connector: { id: string; name: string } | null }>;
  /** null when the stored pack is missing. */
  parser(row: AnalysisRow): ((value: unknown) => P | null) | null;
  reportOf(p: P): string;
  save(claimed: AnalysisRow, p: P, ctx: { report: string; activity: AnalysisRow["activity"]; messages: ManusMessage[]; deadline: number }): Promise<AnalysisRow>;
}

export interface AnalysisView {
  id: string;
  kind: RunKind;
  status: AnalysisStatus;
  trigger: string;
  throughDate: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  taskUrl: string | null;
  activity: AnalysisRow["activity"];
  waiting: AnalysisRow["waiting"];
  error: string | null;
  verdict: string | null;
  healthScore: number | null;
  headline: string | null;
  seen: boolean;
  agentProfile: string;
  /** The analysis result (research results come through researchView instead). */
  result: Omit<ParsedAnalysis, "reportMarkdown"> | null;
  hasReport: boolean;
}

export function analysisView(r: AnalysisRow): AnalysisView {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    trigger: r.trigger,
    throughDate: r.throughDate,
    createdAt: r.createdAt.toISOString(),
    startedAt: r.startedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
    taskUrl: r.taskUrl,
    activity: r.activity ?? null,
    waiting: r.waiting ?? null,
    error: r.error,
    verdict: r.verdict,
    healthScore: r.healthScore,
    headline: r.headline,
    seen: Boolean(r.seenAt),
    agentProfile: r.agentProfile,
    result: r.kind === "analysis" ? ((r.result as AnalysisView["result"]) ?? null) : null,
    hasReport: Boolean(r.reportMd),
  };
}
