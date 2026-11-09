import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { adAnalyses, adSteps, ACTIVE_ANALYSIS, type AnalysisStatus, type RunKind } from "@/lib/ads/tables";
import { getSettings, type AdSettingsRow } from "@/lib/ads/settings";
import { buildPack, entityIn, gatherSnapshots, packIndex, snapshotSummary, type DataPack, type PackHistory, type SnapshotSummary, type Still } from "@/lib/ads/pack";
import { ADS_AUTO_REPLY, PLAYBOOK_VERSION, playbookMarkdown, promptText } from "@/lib/ads/playbook";
import { ANALYSIS_SCHEMA, SCHEMA_VERSION } from "@/lib/ads/schema";
import { jsonFromText, parseAnalysis, type ParsedAnalysis, type ParsedEvidence, type ParsedRefresh, type ParsedTarget } from "@/lib/ads/parse";
import { verifyStep, type Verification } from "@/lib/ads/verify";
import { checkBackAt, DEFAULT_TZ } from "@/lib/ads/time";
import { adsManagerUrl } from "@/lib/ads/links";
import { cachedStructure } from "@/lib/ads/snapshot";
import { notifyNeedsInput, notifyReady } from "@/lib/ads/notify";
import {
  activeRun,
  AD_LIBRARY_CONNECTOR,
  analysisView,
  attachedJson,
  b64,
  cachedConnector,
  claimSave,
  errMsg,
  isUniqueViolation,
  loadRun,
  META_ADS_CONNECTOR,
  setRun,
  structuredOf,
  type AnalysisRow,
  type RunSpec,
} from "@/lib/ads/runs";
import { latestResearchForPack, RESEARCH_SPEC, researchDetail } from "@/lib/ads/research-service";
import {
  activityFrom,
  confirmTaskAction,
  isBackgroundWait,
  isNotConfirmable,
  listTaskMessages,
  ManusError,
  QUESTION_TYPES,
  replyToTask,
  startManusTask,
  stopTask,
  type ManusMessage,
} from "@/lib/creative-studio/manus";

/**
 * Manus runs for the Ads tab — the account analysis and Ad Library research
 * share one engine: queue → build the data pack → start a Manus task →
 * follow it (auto-answer its first question; never approve actions without
 * Marcel) → read the structured result (or its attached JSON) → check it →
 * save. What differs per kind lives in a RunSpec. Every transition is a
 * conditional UPDATE, so the page, the poll and the cron can't trip over
 * each other.
 */

export type { AnalysisRow, AnalysisView } from "@/lib/ads/runs";
export { analysisView } from "@/lib/ads/runs";
export type StepRow = typeof adSteps.$inferSelect;

const STALE_BUILD_MS = 6 * 60_000;
const STALE_SAVE_MS = 5 * 60_000;
const WRITING_UP_MS = 3 * 60_000;
const MAX_ATTEMPTS = 3;

interface StoredPack {
  pack: DataPack["pack"];
  stills: Still[];
}

export const activeAnalysis = (ownerId: string, accountId: string) => activeRun(ownerId, accountId, "analysis");
export const loadAnalysis = loadRun;

/** Queue a run; if one of that kind is already in flight, return that one instead. */
export async function enqueueAnalysis(o: {
  ownerId: string;
  accountId: string;
  trigger: "weekly" | "manual";
  kind?: RunKind;
  weekKey?: string | null;
  startedBy?: string | null;
  agentProfile: string;
}): Promise<{ row: AnalysisRow; created: boolean }> {
  const kind = o.kind ?? "analysis";
  try {
    const [row] = await db
      .insert(adAnalyses)
      .values({ ownerId: o.ownerId, accountId: o.accountId, kind, trigger: o.trigger, weekKey: o.weekKey ?? null, startedBy: o.startedBy ?? null, agentProfile: o.agentProfile, status: "queued" })
      .returning();
    return { row, created: true };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const active = await activeRun(o.ownerId, o.accountId, kind);
    if (active) return { row: active, created: false };
    throw err;
  }
}

// ── The engine ──────────────────────────────────────────

function specOf(row: AnalysisRow): RunSpec<unknown> {
  return (row.kind === "research" ? RESEARCH_SPEC : ANALYSIS_SPEC) as RunSpec<unknown>;
}

/** Starts that died half-way, saves that never finished, runs that never end. */
async function resetIfStale(row: AnalysisRow, spec: RunSpec<unknown>): Promise<AnalysisRow> {
  const age = Date.now() - row.updatedAt.getTime();
  if (row.status === "building" && age > STALE_BUILD_MS) {
    const attempts = row.attempts + 1;
    const [r] = await db
      .update(adAnalyses)
      .set(attempts >= MAX_ATTEMPTS ? { status: "failed", error: "Building the data for Manus kept timing out. Try again.", attempts, updatedAt: new Date() } : { status: "queued", attempts, updatedAt: new Date() })
      .where(and(eq(adAnalyses.id, row.id), eq(adAnalyses.status, "building")))
      .returning();
    return r ?? row;
  }
  if (row.status === "saving" && age > STALE_SAVE_MS) {
    const [r] = await db.update(adAnalyses).set({ status: "running", updatedAt: new Date() }).where(and(eq(adAnalyses.id, row.id), eq(adAnalyses.status, "saving"))).returning();
    return r ?? row;
  }
  if ((row.status === "running" || row.status === "waiting") && row.startedAt && Date.now() - row.startedAt.getTime() > spec.maxRunMs) {
    if (row.manusTaskId) await stopTask(row.manusTaskId);
    const [r] = await db
      .update(adAnalyses)
      .set({ status: "failed", error: `Manus took longer than ${Math.round(spec.maxRunMs / 60_000)} minutes, so the run was stopped. Try again.`, waiting: null, updatedAt: new Date() })
      .where(and(eq(adAnalyses.id, row.id), inArray(adAnalyses.status, ["running", "waiting"])))
      .returning();
    return r ?? row;
  }
  return row;
}

/** Push a run as far as it can go right now. */
export async function advanceAnalysis(row: AnalysisRow, opts: { deadline: number }): Promise<AnalysisRow> {
  const spec = specOf(row);
  let r = await resetIfStale(row, spec);
  if (r.status === "queued") r = await buildAndStart(r, opts, spec);
  if (r.status === "running" || r.status === "waiting") r = await checkRun(r, spec, opts.deadline);
  return r;
}

async function buildAndStart(row: AnalysisRow, opts: { deadline: number }, spec: RunSpec<unknown>): Promise<AnalysisRow> {
  const [claimed] = await db
    .update(adAnalyses)
    .set({ status: "building" as AnalysisStatus, updatedAt: new Date() })
    .where(and(eq(adAnalyses.id, row.id), eq(adAnalyses.status, "queued")))
    .returning();
  if (!claimed) return (await loadRun(row.ownerId, row.id)) ?? row;
  let r = claimed;
  const settings = await getSettings(r.ownerId, r.accountId);

  // 1. The data pack (kept, so a retry only has to start Manus).
  if (!(r.dataPack as { pack?: unknown } | null)?.pack) {
    try {
      const built = await spec.build(r, settings);
      if ("fail" in built) return setRun(r.id, { status: "failed", error: built.fail.slice(0, 500) });
      r = await setRun(r.id, { dataPack: built.dataPack, ...built.patch });
    } catch (err) {
      console.error(`[ads] building the ${r.kind} data failed:`, errMsg(err));
      const attempts = r.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) return setRun(r.id, { status: "failed", attempts, error: `Couldn't gather the account data: ${errMsg(err)}`.slice(0, 500) });
      return setRun(r.id, { status: "queued", attempts, error: null });
    }
  }
  if (Date.now() > opts.deadline - 25_000) return setRun(r.id, { status: "queued" }); // next tick starts Manus

  // 2. Manus.
  const inp = await spec.inputs(r, settings);
  const attempt = (withOptional: boolean, withConnector: boolean) =>
    startManusTask({
      prompt: inp.prompt,
      files: withOptional ? [...inp.files, ...inp.optionalFiles] : inp.files,
      title: inp.title,
      schema: inp.schema,
      connectors: withConnector && inp.connector ? [inp.connector.id] : undefined,
      clearConnectors: !(withConnector && inp.connector),
      agentProfile: r.agentProfile || "standard",
      locale: "en",
      hideInTaskList: false,
    });
  try {
    let task: { taskId: string; taskUrl: string | null };
    try {
      task = await attempt(true, true);
    } catch (err) {
      const m = errMsg(err);
      if (err instanceof ManusError && inp.connector && /connector/i.test(m)) task = await attempt(true, false);
      else if (err instanceof ManusError && inp.optionalFiles.length && /file|url|download|fetch|attachment/i.test(m)) task = await attempt(false, true);
      else throw err;
    }
    return setRun(r.id, {
      status: "running",
      manusTaskId: task.taskId,
      taskUrl: task.taskUrl,
      connectors: inp.connector ? [inp.connector.id] : null,
      startedAt: new Date(),
      error: null,
      activity: null,
      waiting: null,
    });
  } catch (err) {
    const m = errMsg(err);
    console.error("[ads] starting Manus failed:", m);
    if (/MANUS_API_KEY/.test(m)) return setRun(r.id, { status: "failed", error: m });
    if (/rate|limit|busy|429|too many|concurren/i.test(m) && r.attempts + 1 < MAX_ATTEMPTS) return setRun(r.id, { status: "queued", attempts: r.attempts + 1 });
    return setRun(r.id, { status: "failed", error: m.slice(0, 500) });
  }
}

async function checkRun(row: AnalysisRow, spec: RunSpec<unknown>, deadline: number): Promise<AnalysisRow> {
  if (!row.manusTaskId) return row;
  let messages: ManusMessage[];
  try {
    messages = await listTaskMessages(row.manusTaskId, { verbose: true, limit: 100, order: "desc" });
  } catch (err) {
    if (err instanceof ManusError && /MANUS_API_KEY/.test(err.message)) throw err;
    console.warn("[ads] Manus check failed (will retry):", errMsg(err));
    return row;
  }
  const activity = activityFrom(messages);
  const status = messages.find((m) => m.type === "status_update" && m.status_update?.agent_status)?.status_update;
  const agent = status?.agent_status;

  if (agent === "error") {
    const e = messages.find((m) => m.type === "error_message")?.error_message;
    return setRun(row.id, { status: "failed", activity, waiting: null, error: (e?.message || e?.content || status?.description || "Manus stopped with an error").slice(0, 500) });
  }

  if (agent === "waiting") {
    const d = status?.status_detail ?? {};
    const type = d.waiting_for_event_type ?? null;
    if (isBackgroundWait(type)) return setRun(row.id, { activity, ...(row.status === "waiting" ? { status: "running" as AnalysisStatus, waiting: null } : {}) });
    const isQuestion = !type || QUESTION_TYPES.has(type);
    const lastAssistant = messages.find((m) => m.type === "assistant_message")?.assistant_message;
    const prompt = String((isQuestion ? lastAssistant?.content : d.waiting_description) || d.waiting_description || status?.description || "Manus needs input to continue.").slice(0, 1500);
    const key = d.waiting_for_event_id ?? `q:${prompt.slice(0, 200)}`;
    if (row.answeredKey === key) return setRun(row.id, { activity });
    if (isQuestion && row.autoReplies === 0) {
      // Claim the one automatic answer so two pollers can't both send it.
      const [claimed] = await db
        .update(adAnalyses)
        .set({ autoReplies: 1, answeredKey: key, activity, updatedAt: new Date() })
        .where(and(eq(adAnalyses.id, row.id), eq(adAnalyses.autoReplies, 0)))
        .returning();
      if (claimed) {
        await replyToTask(row.manusTaskId, spec.autoReply).catch((err) => console.warn("[ads] auto-reply failed:", errMsg(err)));
        return claimed;
      }
      return row;
    }
    const waiting = { kind: isQuestion ? ("question" as const) : ("confirm" as const), prompt, options: isQuestion ? (lastAssistant?.question_expectation?.options ?? []).slice(0, 6) : [], eventId: d.waiting_for_event_id ?? null, eventType: type, key };
    const r = await setRun(row.id, { status: "waiting", activity, waiting });
    await notifyNeedsInput(r).catch((err) => console.warn("[ads] needs-input alert failed:", errMsg(err)));
    return r;
  }

  if (agent !== "stopped") return setRun(row.id, { activity, ...(row.status === "waiting" ? { status: "running" as AnalysisStatus, waiting: null } : {}) });

  // Finished: the structured result, else its attached JSON, else JSON in its last message.
  const parse = spec.parser(row);
  if (!parse) return setRun(row.id, { status: "failed", error: "The data pack for this run is missing." });
  let structured = structuredOf(messages);
  if (!structured) {
    try {
      structured = structuredOf(await listTaskMessages(row.manusTaskId, { verbose: false, limit: 30, order: "desc" }));
    } catch {
      /* fall through */
    }
  }
  let parsed: unknown = structured?.success ? parse(structured.value) : null;
  if (!parsed) parsed = parse(await attachedJson(messages, spec.jsonName));
  const lastText = messages.find((m) => m.type === "assistant_message" && m.assistant_message?.content)?.assistant_message?.content ?? "";
  if (!parsed && lastText) parsed = parse(jsonFromText(lastText));
  if (parsed) {
    const claimed = await claimSave(row);
    if (!claimed) return (await loadRun(row.ownerId, row.id)) ?? row;
    return spec.save(claimed, parsed, { report: spec.reportOf(parsed) || lastText.slice(0, 60_000), activity, messages, deadline });
  }

  // Manus often stops a moment before its structured result lands.
  if (!row.stoppedAt) return setRun(row.id, { stoppedAt: new Date(), activity });
  if (Date.now() - row.stoppedAt.getTime() < WRITING_UP_MS) return setRun(row.id, { activity });
  return setRun(row.id, {
    status: "failed",
    activity,
    error: (structured?.error ? `Manus finished but its answer couldn't be read: ${structured.error}` : "Manus finished but its answer couldn't be read.").slice(0, 500),
  });
}

// ── The account analysis ────────────────────────────────

const baselineOf = (summary: SnapshotSummary | null, targets: ParsedTarget[]) => targets.map((t) => ({ level: t.level, id: t.id, name: t.name, then: entityIn(summary, t.level, t.id) }));

async function packHistory(ownerId: string, accountId: string, now: SnapshotSummary): Promise<PackHistory> {
  const done = await db
    .select()
    .from(adAnalyses)
    .where(and(eq(adAnalyses.ownerId, ownerId), eq(adAnalyses.accountId, accountId), eq(adAnalyses.kind, "analysis"), eq(adAnalyses.status, "done")))
    .orderBy(desc(adAnalyses.finishedAt))
    .limit(4);
  const last = done[0];
  const steps = last ? await db.select().from(adSteps).where(and(eq(adSteps.analysisId, last.id), ne(adSteps.status, "superseded"))).orderBy(adSteps.idx) : [];
  const then = (last?.snapshotSummary as SnapshotSummary | null) ?? null;
  const changes: string[] = [];
  if (then) {
    const before = new Map(then.ads.map((a) => [a.id, a]));
    for (const a of now.ads) {
      const b = before.get(a.id);
      if (!b && a.createdTime && last?.finishedAt && new Date(a.createdTime) > last.finishedAt) changes.push(`New ad: ${a.name} (${a.id})`);
      else if (b && b.status === "ACTIVE" && a.status !== "ACTIVE") changes.push(`Ad no longer running: ${a.name} (${a.id}) — now ${a.status}`);
    }
    for (const list of [now.adsets, now.campaigns]) {
      for (const e of list) {
        const b = entityIn(then, list === now.adsets ? "adset" : "campaign", e.id);
        if (b && b.dailyBudgetCents !== null && e.dailyBudgetCents !== null && b.dailyBudgetCents !== e.dailyBudgetCents) {
          changes.push(`Daily budget changed on ${e.name} (${e.id}): $${(b.dailyBudgetCents / 100).toFixed(0)} → $${(e.dailyBudgetCents / 100).toFixed(0)}`);
        }
        if (b && b.status === "ACTIVE" && e.status !== "ACTIVE") changes.push(`${list === now.adsets ? "Ad set" : "Campaign"} no longer running: ${e.name} (${e.id})`);
      }
    }
  }
  return {
    previous_analyses: done.map((a) => ({ id: a.id, finished_at: a.finishedAt?.toISOString() ?? null, verdict: a.verdict, health_score: a.healthScore, headline: a.headline })),
    previous_steps: steps.map((s) => {
      const targets = (s.targets as ParsedTarget[]) ?? [];
      const v = verifyStep({ kind: s.kind, createdAt: s.createdAt, targets, budgetChange: s.budgetChange as never, creativeRefresh: s.creativeRefresh as ParsedRefresh | null }, now);
      return {
        id: s.id,
        key: s.stepKey,
        kind: s.kind,
        title: s.title,
        priority: s.priority,
        status: s.status,
        suggested_at: s.firstSuggestedAt.toISOString(),
        done_at: s.doneAt?.toISOString() ?? null,
        note: s.note,
        skipped_reason: s.skippedReason,
        marcel_says: s.selfOutcome,
        verified_in_meta: v ? `${v.state}: ${v.detail}` : null,
        targets,
        metric_then: s.baseline,
        metric_now: baselineOf(now, targets),
      };
    }),
    changes_detected: changes.slice(0, 30),
  };
}

const metaConnector = (settings: AdSettingsRow) => cachedConnector(settings, "manusConnector", META_ADS_CONNECTOR, AD_LIBRARY_CONNECTOR, "Meta Ads Manager");

/** The steps an analysis makes, carried/superseded against the open ones, then done + the ready alert. */
async function saveAnalysis(claimed: AnalysisRow, parsed: ParsedAnalysis, report: string, activity: AnalysisRow["activity"]): Promise<AnalysisRow> {
  const now = new Date();
  const summary = (claimed.snapshotSummary as SnapshotSummary | null) ?? null;
  const tz = claimed.timezone || DEFAULT_TZ;

  // Steps this run replaces (and may continue).
  const open = await db
    .select()
    .from(adSteps)
    .where(and(eq(adSteps.ownerId, claimed.ownerId), eq(adSteps.accountId, claimed.accountId), eq(adSteps.status, "open"), ne(adSteps.analysisId, claimed.id)));
  const openById = new Map(open.map((s) => [s.id, s]));
  const openByKey = new Map(open.map((s) => [s.stepKey, s]));

  await db.delete(adSteps).where(eq(adSteps.analysisId, claimed.id));
  if (parsed.steps.length) {
    await db.insert(adSteps).values(
      parsed.steps.map((s, idx) => {
        const carried = (s.continuesStepId ? openById.get(s.continuesStepId) : undefined) ?? openByKey.get(s.key);
        const wait = s.waitDays ?? s.successCheck?.checkAfterDays ?? null;
        return {
          analysisId: claimed.id,
          ownerId: claimed.ownerId,
          accountId: claimed.accountId,
          idx,
          stepKey: s.key,
          carriedFrom: carried?.id ?? null,
          firstSuggestedAt: carried?.firstSuggestedAt ?? now,
          kind: s.kind,
          priority: s.priority,
          title: s.title,
          why: s.why,
          how: s.how,
          targets: s.targets,
          evidence: s.evidence,
          waitDays: wait,
          checkBackAt: wait !== null ? checkBackAt(now, wait, tz) : null,
          successCheck: s.successCheck,
          creativeRefresh: s.creativeRefresh,
          budgetChange: s.budgetChange,
          expectedImpact: s.expectedImpact,
          confidence: s.confidence,
          effort: s.effort,
          risk: s.risk,
          baseline: baselineOf(summary, s.targets),
        };
      })
    );
  }
  await db
    .update(adSteps)
    .set({ status: "superseded", supersededBy: claimed.id, updatedAt: now })
    .where(and(eq(adSteps.ownerId, claimed.ownerId), eq(adSteps.accountId, claimed.accountId), eq(adSteps.status, "open"), ne(adSteps.analysisId, claimed.id)));
  for (const review of parsed.previousStepsReview) {
    if (!/^[0-9a-f-]{36}$/i.test(review.stepId)) continue;
    await db
      .update(adSteps)
      .set({ manusOutcome: review.outcome, manusOutcomeNote: review.comment, updatedAt: now })
      .where(and(eq(adSteps.id, review.stepId), eq(adSteps.ownerId, claimed.ownerId), ne(adSteps.analysisId, claimed.id)));
  }

  const { reportMarkdown: _omit, ...result } = parsed;
  void _omit;
  const done = await setRun(claimed.id, {
    status: "done",
    result,
    reportMd: report || null,
    verdict: parsed.verdict,
    healthScore: parsed.healthScore,
    headline: parsed.headline.slice(0, 300),
    finishedAt: now,
    activity,
    waiting: null,
    error: null,
  });
  await notifyReady(done).catch((err) => console.warn("[ads] ready alert failed:", errMsg(err)));
  return done;
}

const ANALYSIS_SPEC: RunSpec<ParsedAnalysis> = {
  kind: "analysis",
  maxRunMs: 90 * 60_000,
  autoReply: ADS_AUTO_REPLY,
  jsonName: /ads-analysis\.json$/i,
  async build(r, settings) {
    const snaps = await gatherSnapshots(r.ownerId, r.accountId, settings);
    if (!snaps) return { fail: "Meta ads aren't connected (META_ADS_ACCESS_TOKEN / META_AD_ACCOUNT_ID)." };
    if (!snaps.s30.campaigns.length && snaps.s30.totals.cur.spendCents === 0 && snaps.s30.errors.meta) return { fail: snaps.s30.errors.meta };
    const now = snapshotSummary(snaps.s30);
    const history = await packHistory(r.ownerId, r.accountId, now);
    const research = await latestResearchForPack(r.ownerId, r.accountId).catch(() => null);
    const built = buildPack({ s7: snaps.s7, s30: snaps.s30, s90: snaps.s90, settings, history, research });
    return {
      dataPack: { pack: built.pack, stills: built.stills } satisfies StoredPack,
      patch: { snapshotSummary: now, throughDate: snaps.s30.range.until, timezone: snaps.s30.account.timezone, playbookVersion: PLAYBOOK_VERSION, schemaVersion: SCHEMA_VERSION },
    };
  },
  async inputs(r, settings) {
    const stored = r.dataPack as StoredPack;
    const connector = await metaConnector(settings);
    return {
      prompt: promptText({ trigger: r.trigger === "weekly" ? "weekly" : "manual", throughDate: r.throughDate ?? stored.pack.through_date, hasConnector: Boolean(connector), stills: stored.stills.length }),
      files: [
        { data: b64(JSON.stringify(stored.pack)), filename: "ads-data-pack.json", mimeType: "application/json" },
        { data: b64(playbookMarkdown()), filename: "playbook.md", mimeType: "text/markdown" },
      ],
      optionalFiles: stored.stills,
      title: `Nexli Ads · ${r.trigger === "weekly" ? "weekly" : "on-demand"} analysis · ${r.throughDate ?? ""}`,
      schema: ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
      connector,
    };
  },
  parser(r) {
    const stored = r.dataPack as StoredPack | null;
    if (!stored?.pack) return null;
    const idx = packIndex(stored.pack);
    return (v) => parseAnalysis(v, idx);
  },
  reportOf: (p) => p.reportMarkdown,
  save: (claimed, p, ctx) => saveAnalysis(claimed, p, ctx.report, ctx.activity),
};

/** Marcel's answer to Manus, his OK on an action (only ever from his click), or stop. */
export async function actOnAnalysis(row: AnalysisRow, action: { type: "reply"; text: string } | { type: "allow" } | { type: "stop" } | { type: "seen" }): Promise<{ row: AnalysisRow; error?: string }> {
  if (action.type === "seen") {
    if (row.status !== "done" || row.seenAt) return { row };
    // Seeing the latest also clears older unseen ones of the same kind.
    await db
      .update(adAnalyses)
      .set({ seenAt: new Date() })
      .where(and(eq(adAnalyses.ownerId, row.ownerId), eq(adAnalyses.accountId, row.accountId), eq(adAnalyses.kind, row.kind), eq(adAnalyses.status, "done"), sql`${adAnalyses.seenAt} IS NULL`));
    return { row: (await loadRun(row.ownerId, row.id)) ?? row };
  }
  if (action.type === "stop") {
    if (!(ACTIVE_ANALYSIS as string[]).includes(row.status)) return { row };
    if (row.manusTaskId) await stopTask(row.manusTaskId);
    return { row: await setRun(row.id, { status: "stopped", waiting: null, error: "Stopped." }) };
  }
  if (row.status !== "waiting" || !row.waiting || !row.manusTaskId) return { row, error: "Manus isn't waiting on anything." };
  if (action.type === "reply") {
    const text = action.text.trim().slice(0, 4000);
    if (!text) return { row, error: "Type an answer first." };
    await replyToTask(row.manusTaskId, text);
  } else {
    if (!row.waiting.eventId) return { row, error: "There's nothing to approve." };
    try {
      await confirmTaskAction(row.manusTaskId, row.waiting.eventId);
    } catch (err) {
      if (!isNotConfirmable(err)) throw err;
    }
  }
  return { row: await setRun(row.id, { status: "running", waiting: null, answeredKey: row.waiting.key }) };
}

// ── Views for the page ──────────────────────────────────

export interface StepView {
  id: string;
  analysisId: string;
  idx: number;
  kind: string;
  priority: string;
  title: string;
  why: string;
  how: string;
  targets: (ParsedTarget & { adsManagerUrl: string | null })[];
  evidence: ParsedEvidence[];
  waitDays: number | null;
  checkBackAt: string | null;
  checkedAt: string | null;
  due: boolean;
  successCheck: { metric: string; targetDisplay: string; checkAfterDays: number | null } | null;
  creativeRefresh: ParsedRefresh | null;
  budgetChange: { fromCents: number | null; toCents: number | null } | null;
  expectedImpact: string;
  confidence: string;
  effort: string | null;
  risk: string | null;
  status: string;
  doneAt: string | null;
  skippedReason: string | null;
  note: string | null;
  selfOutcome: string | null;
  manusOutcome: string | null;
  manusOutcomeNote: string | null;
  handoff: { kind: string; at: string } | null;
  firstSuggestedAt: string;
  carried: boolean;
  createdAt: string;
  verification: Verification | null;
}

export function stepView(s: StepRow, account: string, now: SnapshotSummary | null): StepView {
  const targets = ((s.targets as ParsedTarget[]) ?? []).map((t) => ({ ...t, adsManagerUrl: t.id ? adsManagerUrl(account, t.level, t.id) : null }));
  return {
    id: s.id,
    analysisId: s.analysisId,
    idx: s.idx,
    kind: s.kind,
    priority: s.priority,
    title: s.title,
    why: s.why,
    how: s.how,
    targets,
    evidence: (s.evidence as ParsedEvidence[]) ?? [],
    waitDays: s.waitDays,
    checkBackAt: s.checkBackAt?.toISOString() ?? null,
    checkedAt: s.checkedAt?.toISOString() ?? null,
    due: Boolean(s.checkBackAt && s.checkBackAt.getTime() <= Date.now() && !s.checkedAt && (s.status === "open" || s.status === "done")),
    successCheck: (s.successCheck as StepView["successCheck"]) ?? null,
    creativeRefresh: (s.creativeRefresh as ParsedRefresh | null) ?? null,
    budgetChange: (s.budgetChange as StepView["budgetChange"]) ?? null,
    expectedImpact: s.expectedImpact,
    confidence: s.confidence,
    effort: s.effort,
    risk: s.risk,
    status: s.status,
    doneAt: s.doneAt?.toISOString() ?? null,
    skippedReason: s.skippedReason,
    note: s.note,
    selfOutcome: s.selfOutcome,
    manusOutcome: s.manusOutcome,
    manusOutcomeNote: s.manusOutcomeNote,
    handoff: (s.handoff as StepView["handoff"]) ?? null,
    firstSuggestedAt: s.firstSuggestedAt.toISOString(),
    carried: Boolean(s.carriedFrom),
    createdAt: s.createdAt.toISOString(),
    verification:
      s.status === "skipped" || s.status === "superseded"
        ? null
        : verifyStep({ kind: s.kind, createdAt: s.createdAt, targets: (s.targets as ParsedTarget[]) ?? [], budgetChange: s.budgetChange as StepView["budgetChange"], creativeRefresh: s.creativeRefresh as ParsedRefresh | null }, now),
  };
}

export interface AnalysisSummaryRow {
  id: string;
  status: string;
  trigger: string;
  createdAt: string;
  finishedAt: string | null;
  verdict: string | null;
  healthScore: number | null;
  headline: string | null;
  error: string | null;
  stepsDone: number;
  stepsTotal: number;
}

/** Everything the page needs about the analysis (DB only — fast). */
export async function analysisState(ownerId: string, accountId: string) {
  const mine = and(eq(adAnalyses.ownerId, ownerId), eq(adAnalyses.accountId, accountId), eq(adAnalyses.kind, "analysis"));
  const [active, latestRows, history] = await Promise.all([
    activeAnalysis(ownerId, accountId),
    db.select().from(adAnalyses).where(and(mine, eq(adAnalyses.status, "done"))).orderBy(desc(adAnalyses.finishedAt)).limit(1),
    db
      .select({
        id: adAnalyses.id,
        status: adAnalyses.status,
        trigger: adAnalyses.trigger,
        createdAt: adAnalyses.createdAt,
        finishedAt: adAnalyses.finishedAt,
        verdict: adAnalyses.verdict,
        healthScore: adAnalyses.healthScore,
        headline: adAnalyses.headline,
        error: adAnalyses.error,
      })
      .from(adAnalyses)
      .where(and(mine, inArray(adAnalyses.status, ["done", "failed", "stopped"])))
      .orderBy(desc(adAnalyses.createdAt))
      .limit(12),
  ]);
  const latest = latestRows[0] ?? null;
  const [steps, counts, now] = await Promise.all([
    latest ? db.select().from(adSteps).where(and(eq(adSteps.analysisId, latest.id), ne(adSteps.status, "superseded"))).orderBy(adSteps.idx) : Promise.resolve([] as StepRow[]),
    history.length
      ? db
          .select({ analysisId: adSteps.analysisId, total: sql<number>`count(*)::int`, done: sql<number>`count(*) filter (where ${adSteps.status} = 'done')::int` })
          .from(adSteps)
          .where(inArray(adSteps.analysisId, history.map((h) => h.id)))
          .groupBy(adSteps.analysisId)
      : Promise.resolve([] as { analysisId: string; total: number; done: number }[]),
    cachedStructure(ownerId, accountId).catch(() => null),
  ]);
  const byId = new Map(counts.map((c) => [c.analysisId, c]));
  return {
    active: active ? analysisView(active) : null,
    latest: latest ? analysisView(latest) : null,
    steps: steps.map((s) => stepView(s, accountId, now)),
    history: history.map(
      (h): AnalysisSummaryRow => ({
        id: h.id,
        status: h.status,
        trigger: h.trigger,
        createdAt: h.createdAt.toISOString(),
        finishedAt: h.finishedAt?.toISOString() ?? null,
        verdict: h.verdict,
        healthScore: h.healthScore,
        headline: h.headline,
        error: h.error,
        stepsDone: byId.get(h.id)?.done ?? 0,
        stepsTotal: byId.get(h.id)?.total ?? 0,
      })
    ),
  };
}

/** One past run: an analysis with its report and steps, or a research run with its findings. */
export async function analysisDetail(row: AnalysisRow) {
  if (row.kind === "research") return researchDetail(row);
  const steps = await db.select().from(adSteps).where(eq(adSteps.analysisId, row.id)).orderBy(adSteps.idx);
  return { analysis: analysisView(row), report: row.reportMd, steps: steps.map((s) => stepView(s, row.accountId, null)), research: null };
}

/** Runs of either kind the cron should keep moving. */
export async function analysesToAdvance(): Promise<AnalysisRow[]> {
  return db.select().from(adAnalyses).where(inArray(adAnalyses.status, ACTIVE_ANALYSIS)).orderBy(adAnalyses.createdAt).limit(6);
}

/** Old packs are big; keep 12 weeks. */
export async function pruneOldPacks(): Promise<void> {
  await db
    .update(adAnalyses)
    .set({ dataPack: null })
    .where(and(lt(adAnalyses.createdAt, new Date(Date.now() - 84 * 86400000)), sql`${adAnalyses.dataPack} IS NOT NULL`));
}
