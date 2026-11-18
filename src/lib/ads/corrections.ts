import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { adChanges, adSettings } from "@/lib/ads/tables";
import { getSettings } from "@/lib/ads/settings";
import { isMetaKind, type MetaPayload } from "@/lib/ads/meta-changes-shared";
import { runMetaApply, runMetaUndo } from "@/lib/ads/meta-write";
import {
  snapshotCorrections,
  type CallOverridePayload,
  type ChangeKind,
  type ChangeView,
  type GoalsPayload,
  type GoalsValues,
  type LeadCorrection,
  type SnapshotCorrections,
} from "@/lib/ads/corrections-shared";

/**
 * Marcel's corrections (server): the changes Claude proposes in the Ask chat,
 * applied only when Marcel taps Apply, and undone the same way. Applied lead
 * fixes and Cut / Keep calls are read by every snapshot, so the plan, the
 * cards, the scorecard, the morning plan, Manus's pack and the creative ideas
 * all count them.
 */

type Row = typeof adChanges.$inferSelect;

/** A change in Meta that's been "applying" or "undoing" this long stopped part-way (the request died): treat it as applied. */
const STUCK_MS = 6 * 60 * 1000;
const stuck = (r: Row) =>
  (r.status === "applying" && (!r.appliedAt || Date.now() - r.appliedAt.getTime() > STUCK_MS)) || (r.status === "undoing" && (!r.undoneAt || Date.now() - r.undoneAt.getTime() > STUCK_MS));

export const changeView = (r: Row): ChangeView => ({
  id: r.id,
  kind: r.kind as ChangeKind,
  adId: r.adId,
  summary: r.summary,
  reason: r.reason,
  status: stuck(r) ? "applied" : r.status,
  payload: r.payload as ChangeView["payload"],
  createdAt: r.createdAt.toISOString(),
  appliedAt: r.appliedAt ? r.appliedAt.toISOString() : null,
  undoneAt: r.undoneAt ? r.undoneAt.toISOString() : null,
});

/** Applied corrections for a snapshot. Never throws (the morning job keeps working without them). */
export async function loadCorrections(ownerId: string, accountId: string): Promise<{ fixes: LeadCorrection[]; snapshot: SnapshotCorrections }> {
  try {
    const rows = await db
      .select()
      .from(adChanges)
      .where(and(eq(adChanges.ownerId, ownerId), eq(adChanges.accountId, accountId), eq(adChanges.status, "applied")));
    const fixes: LeadCorrection[] = [];
    for (const r of rows) {
      const p = r.payload as { contactId?: string };
      if ((r.kind === "lead_not_real" || r.kind === "booking_not_real") && typeof p?.contactId === "string") fixes.push({ kind: r.kind, contactId: p.contactId });
    }
    return {
      fixes,
      snapshot: snapshotCorrections(rows.map((r) => ({ id: r.id, kind: r.kind as ChangeKind, adId: r.adId, reason: r.reason, payload: r.payload, appliedAt: r.appliedAt?.toISOString() ?? null }))),
    };
  } catch (err) {
    console.error("[ads] corrections unavailable:", err instanceof Error ? err.message : err);
    return { fixes: [], snapshot: { overrides: {}, leadFixes: {}, count: 0 } };
  }
}

/** Open proposals and everything applied (newest first), plus recent history for the list. */
export async function listChanges(ownerId: string, accountId: string): Promise<ChangeView[]> {
  const rows = await db
    .select()
    .from(adChanges)
    .where(and(eq(adChanges.ownerId, ownerId), eq(adChanges.accountId, accountId), ne(adChanges.status, "dismissed")))
    .orderBy(desc(adChanges.createdAt))
    .limit(80);
  return rows.map(changeView);
}

export async function changesByIds(ownerId: string, ids: string[]): Promise<ChangeView[]> {
  if (!ids.length) return [];
  const rows = await db.select().from(adChanges).where(and(eq(adChanges.ownerId, ownerId), inArray(adChanges.id, ids)));
  return rows.map(changeView);
}

export async function proposeChange(o: {
  ownerId: string;
  accountId: string;
  chatId: string | null;
  actorId: string;
  kind: ChangeKind;
  adId: string | null;
  payload: unknown;
  summary: string;
  reason: string;
}): Promise<ChangeView> {
  const [row] = await db
    .insert(adChanges)
    .values({
      ownerId: o.ownerId,
      accountId: o.accountId,
      chatId: o.chatId,
      kind: o.kind,
      adId: o.adId,
      payload: o.payload,
      summary: o.summary.slice(0, 300),
      reason: o.reason.slice(0, 600),
      createdBy: o.actorId,
    })
    .returning();
  return changeView(row);
}

export const goalsOf = (s: typeof adSettings.$inferSelect): GoalsValues => ({
  targetCpbCents: s.targetCpbCents,
  targetCplCents: s.targetCplCents,
  monthlyBudgetCents: s.monthlyBudgetCents,
  context: s.context,
});

const sameGoals = (a: GoalsValues, b: GoalsValues) =>
  a.targetCpbCents === b.targetCpbCents && a.targetCplCents === b.targetCplCents && a.monthlyBudgetCents === b.monthlyBudgetCents && a.context === b.context;

export type ChangeAction = "apply" | "dismiss" | "undo";

/** Apply, dismiss or undo one change. Returns the updated change, or an error Marcel can read. */
export type ActResult = { ok: true; change: ChangeView; goalsChanged: boolean; metaChanged?: boolean; warning?: string | null } | { ok: false; status: number; error: string };

export async function actOnChange(o: { ownerId: string; accountId: string; actorId: string; id: string; action: ChangeAction }): Promise<ActResult> {
  const [row] = await db
    .select()
    .from(adChanges)
    .where(and(eq(adChanges.id, o.id), eq(adChanges.ownerId, o.ownerId), eq(adChanges.accountId, o.accountId)))
    .limit(1);
  if (!row) return { ok: false, status: 404, error: "That change isn't there anymore." };
  if (isMetaKind(row.kind)) return actOnMeta(o, row);
  const now = new Date();
  const set = async (patch: Partial<typeof adChanges.$inferInsert>, from: Row["status"]) => {
    const [saved] = await db
      .update(adChanges)
      .set(patch)
      .where(and(eq(adChanges.id, row.id), eq(adChanges.status, from)))
      .returning();
    return saved ?? null;
  };

  if (o.action === "dismiss") {
    if (row.status !== "proposed") return { ok: false, status: 409, error: "Only a suggestion that hasn't been applied can be dismissed." };
    const saved = await set({ status: "dismissed" }, "proposed");
    return saved ? { ok: true, change: changeView(saved), goalsChanged: false } : { ok: false, status: 409, error: "It changed just now — reload and try again." };
  }

  if (o.action === "apply") {
    if (row.status !== "proposed") return { ok: false, status: 409, error: row.status === "applied" ? "That's already applied." : "That suggestion was closed." };
    let goalsChanged = false;
    if (row.kind === "goals") {
      const p = row.payload as GoalsPayload;
      const settings = await getSettings(o.ownerId, o.accountId);
      if (!sameGoals(goalsOf(settings), p.before)) return { ok: false, status: 409, error: "Your goals changed since Claude suggested this — ask it again so it works from the new ones." };
      await db
        .update(adSettings)
        .set({ targetCpbCents: p.after.targetCpbCents, targetCplCents: p.after.targetCplCents, monthlyBudgetCents: p.after.monthlyBudgetCents, context: p.after.context, updatedBy: o.actorId, updatedAt: now })
        .where(and(eq(adSettings.ownerId, o.ownerId), eq(adSettings.accountId, o.accountId)));
      goalsChanged = true;
    }
    if (row.kind === "call_override") {
      // The newest call on a creative replaces the one before it.
      const p = row.payload as CallOverridePayload;
      await db
        .update(adChanges)
        .set({ status: "undone", undoneAt: now })
        .where(and(eq(adChanges.ownerId, o.ownerId), eq(adChanges.accountId, o.accountId), eq(adChanges.kind, "call_override"), eq(adChanges.status, "applied"), eq(adChanges.adId, p.adId)));
    }
    if (row.kind === "lead_not_real" || row.kind === "booking_not_real") {
      // One fix per contact: a whole-lead removal covers its booking too.
      const contactId = (row.payload as { contactId: string }).contactId;
      const others = await db
        .select()
        .from(adChanges)
        .where(and(eq(adChanges.ownerId, o.ownerId), eq(adChanges.accountId, o.accountId), eq(adChanges.status, "applied"), inArray(adChanges.kind, ["lead_not_real", "booking_not_real"])));
      const same = others.filter((x) => (x.payload as { contactId?: string })?.contactId === contactId);
      if (same.some((x) => x.kind === "lead_not_real" || x.kind === row.kind)) return { ok: false, status: 409, error: "That lead is already corrected." };
      if (row.kind === "lead_not_real" && same.length) {
        await db.update(adChanges).set({ status: "undone", undoneAt: now }).where(inArray(adChanges.id, same.map((x) => x.id)));
      }
    }
    const saved = await set({ status: "applied", appliedAt: now, appliedBy: o.actorId }, "proposed");
    return saved ? { ok: true, change: changeView(saved), goalsChanged } : { ok: false, status: 409, error: "It changed just now — reload and try again." };
  }

  // undo
  if (row.status !== "applied") return { ok: false, status: 409, error: "Only an applied change can be undone." };
  let goalsChanged = false;
  if (row.kind === "goals") {
    const p = row.payload as GoalsPayload;
    const settings = await getSettings(o.ownerId, o.accountId);
    if (!sameGoals(goalsOf(settings), p.after)) return { ok: false, status: 409, error: "Your goals were changed again after this, so undoing it would overwrite that. Change them in Goals instead." };
    await db
      .update(adSettings)
      .set({ targetCpbCents: p.before.targetCpbCents, targetCplCents: p.before.targetCplCents, monthlyBudgetCents: p.before.monthlyBudgetCents, context: p.before.context, updatedBy: o.actorId, updatedAt: now })
      .where(and(eq(adSettings.ownerId, o.ownerId), eq(adSettings.accountId, o.accountId)));
    goalsChanged = true;
  }
  const saved = await set({ status: "undone", undoneAt: now }, "applied");
  return saved ? { ok: true, change: changeView(saved), goalsChanged } : { ok: false, status: 409, error: "It changed just now — reload and try again." };
}

// ── Changes in Meta ───────────────────────────────────────

/**
 * Apply / undo a change in Meta. The row is claimed first (proposed →
 * applying, applied → undoing) so a double tap can never run it twice; each
 * step's result is saved as it happens.
 */
async function actOnMeta(o: { ownerId: string; accountId: string; actorId: string; id: string; action: ChangeAction }, row: Row): Promise<ActResult> {
  const kind = row.kind as "meta_status" | "meta_budget" | "meta_copy";
  const payload = row.payload as MetaPayload;
  const byId = and(eq(adChanges.id, row.id), eq(adChanges.ownerId, o.ownerId));
  const claim = async (from: Row["status"][], patch: Partial<typeof adChanges.$inferInsert>) => {
    const [saved] = await db
      .update(adChanges)
      .set(patch)
      .where(and(byId, inArray(adChanges.status, from)))
      .returning();
    return saved ?? null;
  };

  if (o.action === "dismiss") {
    if (row.status !== "proposed") return { ok: false, status: 409, error: "Only a suggestion that hasn't been applied can be dismissed." };
    const saved = await claim(["proposed"], { status: "dismissed" });
    return saved ? { ok: true, change: changeView(saved), goalsChanged: false } : { ok: false, status: 409, error: "It changed just now — reload and try again." };
  }

  if (o.action === "apply") {
    if (row.status !== "proposed") return { ok: false, status: 409, error: row.status === "applied" ? "That's already applied." : row.status === "applying" ? "It's being applied right now." : "That suggestion was closed." };
    const started = new Date();
    const claimed = await claim(["proposed"], { status: "applying", appliedAt: started, appliedBy: o.actorId });
    if (!claimed) return { ok: false, status: 409, error: "It's already being applied — give it a moment." };
    const save = async (result: MetaPayload["result"]) => {
      await db.update(adChanges).set({ payload: { ...payload, result } }).where(byId);
    };
    let out: Awaited<ReturnType<typeof runMetaApply>>;
    try {
      out = await runMetaApply({ ownerId: o.ownerId, accountId: o.accountId, kind, payload, save });
    } catch (err) {
      console.error("[ads] Meta change failed:", err instanceof Error ? err.message : err);
      // Whatever was saved before it broke still counts.
      const [now] = await db.select().from(adChanges).where(byId).limit(1);
      const r = (now?.payload as MetaPayload | undefined)?.result;
      const any = Boolean(r?.done.some((d) => d.what !== "already"));
      const [saved] = await db
        .update(adChanges)
        .set(any ? { status: "applied" } : { status: "proposed", appliedAt: null, appliedBy: null, payload })
        .where(byId)
        .returning();
      return any && saved
        ? { ok: true, change: changeView(saved), goalsChanged: false, metaChanged: true, warning: "It stopped part-way — what was done is on the card, and Undo takes it back." }
        : { ok: false, status: 502, error: "Something went wrong talking to Meta — nothing was changed. Try again." };
    }
    if (out.nothingChanged && out.error) {
      await db.update(adChanges).set({ status: "proposed", appliedAt: null, appliedBy: null, payload }).where(byId);
      return { ok: false, status: 502, error: out.error };
    }
    const [saved] = await db
      .update(adChanges)
      .set({ status: "applied", payload: { ...payload, result: out.result } })
      .where(byId)
      .returning();
    return { ok: true, change: changeView(saved ?? claimed), goalsChanged: false, metaChanged: !out.nothingChanged, warning: out.error };
  }

  // undo
  const view = changeView(row);
  if (view.status !== "applied") return { ok: false, status: 409, error: row.status === "undoing" ? "It's being undone right now." : "Only an applied change can be undone." };
  const claimed = await claim([row.status], { status: "undoing", undoneAt: new Date() });
  if (!claimed) return { ok: false, status: 409, error: "It's already being undone — give it a moment." };
  let u: Awaited<ReturnType<typeof runMetaUndo>>;
  try {
    u = await runMetaUndo({ ownerId: o.ownerId, accountId: o.accountId, kind, payload });
  } catch (err) {
    console.error("[ads] Meta undo failed:", err instanceof Error ? err.message : err);
    u = { done: payload.result?.undo?.done ?? [], ids: payload.result?.undo?.ids ?? [], error: "Something went wrong talking to Meta.", nothing: true };
  }
  const result = payload.result ? { ...payload.result, undo: { at: new Date().toISOString(), done: u.done, failed: u.error, ids: u.ids } } : undefined;
  const finished = !u.error;
  const [saved] = await db
    .update(adChanges)
    .set({ status: finished ? "undone" : "applied", undoneAt: finished ? new Date() : null, payload: { ...payload, result } })
    .where(byId)
    .returning();
  if (!finished) {
    return u.nothing
      ? { ok: false, status: 502, error: u.error ?? "Couldn't undo it." }
      : { ok: true, change: changeView(saved ?? claimed), goalsChanged: false, metaChanged: true, warning: `Undid part of it: ${u.error}` };
  }
  return { ok: true, change: changeView(saved ?? claimed), goalsChanged: false, metaChanged: true, warning: null };
}
