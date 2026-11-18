import { createHash } from "node:crypto";
import { graphGet, graphUrl, type GraphError, type MetaCreds } from "@/lib/meta-ads";
import { adsCache } from "@/lib/ads/cache";
import { patchBase, staleBase } from "@/lib/ads/base-cache";
import { adsManagerUrl } from "@/lib/ads/links";
import {
  copySteps,
  copyUndoTargets,
  money0,
  resolveRef,
  type MetaBudgetPayload,
  type MetaCopyPayload,
  type MetaDone,
  type MetaKind,
  type MetaPayload,
  type MetaResult,
  type MetaStatusPayload,
} from "@/lib/ads/meta-changes-shared";

/**
 * Changing Meta from the Ads page (server). Only ever runs when Marcel taps
 * Apply (or a Turn off button) — never from Claude directly. Uses its own
 * token, META_ADS_MANAGE_TOKEN (System User, ads_management), so the read
 * token stays read-only and deleting this one setting switches every change
 * off. The token never leaves the server and is scrubbed from every log.
 *
 * Each step's result is saved on the change as it happens, so a copy that
 * stops part-way still shows what was made and can be undone.
 */

export const META_SETUP_STEPS = [
  "In Meta Business Settings → Users → System users, open the portal's system user (NEXLI PORTAL AD VIEW) → Assign assets → Ad accounts → your ad account → turn on \"Manage campaigns\". On your Facebook Page (and Instagram account) give it \"Ads\" too.",
  "Same system user → Generate new token → your app → expiry \"Never\" → tick ads_management, ads_read, pages_read_engagement, pages_show_list and pages_manage_ads. (If ads_management isn't listed, add the Marketing API to the app in developers.facebook.com first.)",
  "In Vercel → nexli-portal → Settings → Environment Variables (Production) add META_ADS_MANAGE_TOKEN with that token, then redeploy. Leave META_ADS_ACCESS_TOKEN as it is. Deleting META_ADS_MANAGE_TOKEN later switches changes off again.",
];

export const metaWriteConfigured = () => Boolean(process.env.META_ADS_MANAGE_TOKEN?.trim());

export function manageCreds(accountId: string): MetaCreds | null {
  const token = process.env.META_ADS_MANAGE_TOKEN?.trim() || "";
  const account = accountId.trim().replace(/^act_/i, "");
  if (!token || !account) return null;
  return { token, account, version: process.env.META_API_VERSION || "v21.0" };
}

const scrub = (message: string, token: string) => (token ? message.split(token).join("[redacted]") : message).slice(0, 400);

type WriteError = GraphError & { error_user_title?: string; error_user_msg?: string };
type PostResult<T> = { ok: true; body: T } | { ok: false; error: string };

/** POST to the Graph API (form body, so the token never sits in a URL). Never throws. */
async function graphPost<T>(creds: MetaCreds, path: string, params: Record<string, string>, label: string): Promise<PostResult<T>> {
  try {
    const res = await fetch(`https://graph.facebook.com/${creds.version}/${path}`, {
      method: "POST",
      body: new URLSearchParams({ ...params, access_token: creds.token }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    let body: (T & { error?: WriteError }) | null = null;
    try {
      body = (await res.json()) as T & { error?: WriteError };
    } catch {
      /* not JSON */
    }
    if (!res.ok || !body || body.error) {
      const e = body?.error;
      const msg = e?.error_user_msg || e?.message || `Meta answered HTTP ${res.status}`;
      const title = e?.error_user_title && e.error_user_msg ? `${e.error_user_title}: ` : "";
      console.error(`[meta-write] ${label} failed (HTTP ${res.status}, code ${e?.code ?? "?"}, subcode ${e?.error_subcode ?? "-"}): ${scrub(msg, creds.token)}`);
      return { ok: false, error: scrub(`${title}${msg}`, creds.token) };
    }
    console.log(`[meta-write] ${label} ok`);
    return { ok: true, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[meta-write] ${label} threw:`, scrub(msg, creds.token));
    return { ok: false, error: scrub(`Couldn't reach Meta: ${msg}`, creds.token) };
  }
}

async function readNode<T extends { error?: GraphError }>(creds: MetaCreds, id: string, fields: string, label: string) {
  return graphGet<T>(graphUrl(creds, encodeURIComponent(id), { fields }), creds.token, label);
}

// ── Can it write? ─────────────────────────────────────────

export interface MetaWriteAccess {
  configured: boolean;
  /** Configured and nothing found that would stop a change. */
  canWrite: boolean;
  /** Things that will make Meta refuse (fix them in Business Settings). */
  problems: string[];
  /** Couldn't check something (doesn't block). */
  notes: string[];
  checkedAt: string;
}

/** Checks the manage token: ads_management granted, and the system user can run ads on this account. Cached 10 minutes. */
export async function metaWriteAccess(ownerId: string, accountId: string, refresh = false): Promise<MetaWriteAccess> {
  const creds = manageCreds(accountId);
  if (!creds) return { configured: false, canWrite: false, problems: [], notes: [], checkedAt: new Date().toISOString() };
  const tokenKey = createHash("sha1").update(creds.token).digest("hex").slice(0, 10);
  const r = await adsCache<MetaWriteAccess>({
    userId: ownerId,
    layer: "write-check",
    key: `v1:${creds.account}:${tokenKey}`,
    ttlMs: 10 * 60 * 1000,
    refresh,
    load: async () => {
      const problems: string[] = [];
      const notes: string[] = [];
      const [perms, acct] = await Promise.all([
        graphGet<{ data?: { permission: string; status: string }[]; error?: GraphError }>(graphUrl(creds, "me/permissions", {}), creds.token, "manage token permissions"),
        graphGet<{ user_tasks?: string[]; name?: string; error?: GraphError }>(graphUrl(creds, `act_${encodeURIComponent(creds.account)}`, { fields: "name,user_tasks" }), creds.token, "manage token ad account"),
      ]);
      if (perms.ok) {
        const granted = new Set((perms.body.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission));
        if (!granted.has("ads_management")) problems.push("The token doesn't have ads_management — generate it again with ads_management ticked.");
      } else notes.push(`Couldn't read the token's permissions: ${perms.error}`);
      if (acct.ok) {
        const tasks = acct.body.user_tasks;
        if (Array.isArray(tasks) && !tasks.some((t) => t === "ADVERTISE" || t === "MANAGE")) {
          problems.push("The system user can only view this ad account — give it \"Manage campaigns\" in Business Settings → Ad accounts.");
        }
      } else if (/token|session|OAuth|permission/i.test(acct.error)) problems.push(`Meta refused the token for this ad account: ${acct.error}`);
      else notes.push(`Couldn't check the ad account: ${acct.error}`);
      const value: MetaWriteAccess = { configured: true, canWrite: problems.length === 0, problems, notes, checkedAt: new Date().toISOString() };
      return { ok: perms.ok || acct.ok, value };
    },
  });
  return r.value;
}

// ── Running a change ──────────────────────────────────────

export interface RunOutcome {
  result: MetaResult;
  /** Meta wasn't changed at all (the card can stay waiting). */
  nothingChanged: boolean;
  /** For Marcel when it didn't (fully) work. */
  error: string | null;
}

type Save = (r: MetaResult) => Promise<void>;
const NOT_ON = `Changes in Meta aren't switched on yet. ${META_SETUP_STEPS.join(" ")}`;

type NodeState = { status?: string; effective_status?: string; daily_budget?: string; lifetime_budget?: string; name?: string; error?: GraphError };

export async function runMetaApply(o: { ownerId: string; accountId: string; kind: MetaKind; payload: MetaPayload; save: Save }): Promise<RunOutcome> {
  const creds = manageCreds(o.accountId);
  const result: MetaResult = { at: new Date().toISOString(), ok: false, done: [], failed: null, undo: null };
  if (!creds) return { result, nothingChanged: true, error: NOT_ON };
  let out: RunOutcome;
  if (o.kind === "meta_status") out = await applyStatus(creds, o.payload as MetaStatusPayload, result, o.save);
  else if (o.kind === "meta_budget") out = await applyBudget(creds, o.payload as MetaBudgetPayload, result, o.save);
  else out = await applyCopy(creds, o.payload as MetaCopyPayload, result, o.save);
  if (!out.nothingChanged) await refreshCache(o.ownerId, o.accountId, o.kind, out.result, o.kind === "meta_budget" ? (o.payload as MetaBudgetPayload) : null);
  return out;
}

async function applyStatus(creds: MetaCreds, p: MetaStatusPayload, result: MetaResult, save: Save): Promise<RunOutcome> {
  const to = p.to;
  for (const t of p.targets) {
    const cur = await readNode<NodeState>(creds, t.id, "status,effective_status,name", `read ${t.level}`);
    if (!cur.ok) {
      result.failed = { step: `“${t.name}”`, error: cur.error };
      break;
    }
    const now = cur.body.status ?? "";
    if (now === to) {
      result.done.push(withUrl(creds, { key: t.id, level: t.level, id: t.id, name: t.name, what: "already" }));
      continue;
    }
    if (now === "DELETED" || now === "ARCHIVED") {
      result.failed = { step: `“${t.name}”`, error: `It's ${now.toLowerCase()} in Meta, so it can't be turned ${to === "ACTIVE" ? "on" : "off"}.` };
      break;
    }
    const r = await graphPost<{ success?: boolean }>(creds, encodeURIComponent(t.id), { status: to }, `${to === "ACTIVE" ? "turn on" : "turn off"} ${t.level}`);
    if (!r.ok) {
      result.failed = { step: `“${t.name}”`, error: r.error };
      break;
    }
    result.done.push(withUrl(creds, { key: t.id, level: t.level, id: t.id, name: t.name, what: to === "ACTIVE" ? "on" : "off", before: now }));
    await save(result);
  }
  result.ok = !result.failed;
  const changed = result.done.some((d) => d.what === "on" || d.what === "off");
  const nothingChanged = !changed && Boolean(result.failed);
  return { result, nothingChanged: !changed, error: result.failed ? failText(result, nothingChanged) : null };
}

async function applyBudget(creds: MetaCreds, p: MetaBudgetPayload, result: MetaResult, save: Save): Promise<RunOutcome> {
  const cur = await readNode<NodeState>(creds, p.id, "daily_budget,lifetime_budget,name", `read ${p.level} budget`);
  if (!cur.ok) return { result, nothingChanged: true, error: `Couldn't read the budget from Meta: ${cur.error}` };
  const daily = Number(cur.body.daily_budget ?? 0);
  if (!daily && Number(cur.body.lifetime_budget ?? 0)) return { result, nothingChanged: true, error: "It has a lifetime budget now — change that in Ads Manager." };
  if (daily !== p.beforeCents) {
    return { result, nothingChanged: true, error: `It's ${money0(daily)} a day in Meta now, not ${money0(p.beforeCents)} — it was changed since. Ask again so the card starts from the real number.` };
  }
  const r = await graphPost<{ success?: boolean }>(creds, encodeURIComponent(p.id), { daily_budget: String(p.afterCents) }, `${p.level} budget`);
  if (!r.ok) return { result, nothingChanged: true, error: `Meta didn't take it: ${r.error}` };
  result.done.push(withUrl(creds, { key: p.id, level: p.level, id: p.id, name: p.name, what: "budget", before: p.beforeCents }));
  result.ok = true;
  await save(result);
  return { result, nothingChanged: false, error: null };
}

const NO_RENAME = JSON.stringify({ rename_strategy: "NO_RENAME" });

/** Where to see it in Ads Manager (on the card). */
const withUrl = (creds: MetaCreds, d: MetaDone): MetaDone => ({ ...d, url: adsManagerUrl(creds.account, d.level, d.id) });

async function applyCopy(creds: MetaCreds, p: MetaCopyPayload, result: MetaResult, save: Save): Promise<RunOutcome> {
  const made: Record<string, string> = {};
  for (const step of copySteps(p)) {
    const fail = (error: string) => {
      result.failed = { step: stepLabel(step), error };
    };
    if (step.op === "copy_campaign") {
      const r = await graphPost<{ copied_campaign_id?: string }>(creds, `${encodeURIComponent(step.fromId)}/copies`, { deep_copy: "false", status_option: "PAUSED", rename_options: NO_RENAME }, "copy campaign");
      if (!r.ok || !r.body.copied_campaign_id) {
        fail(r.ok ? "Meta didn't say what it made." : r.error);
        break;
      }
      made[step.ref] = r.body.copied_campaign_id;
      result.done.push(withUrl(creds, { key: step.key, level: "campaign", id: made[step.ref], name: step.name, what: "made", fromId: step.fromId }));
      await save(result);
      const n = await graphPost(creds, encodeURIComponent(made[step.ref]), { name: step.name }, "name campaign copy");
      if (!n.ok) {
        fail(`The copy was made but couldn't be renamed: ${n.error}`);
        break;
      }
    } else if (step.op === "copy_adset") {
      const parent = resolveRef(step.parent, made);
      if (!parent) {
        fail("Its campaign wasn't made.");
        break;
      }
      const r = await graphPost<{ copied_adset_id?: string }>(
        creds,
        `${encodeURIComponent(step.fromId)}/copies`,
        { campaign_id: parent, deep_copy: "false", status_option: "PAUSED", rename_options: NO_RENAME, ...(step.endTimeZero ? { end_time: "0" } : {}) },
        "copy ad set"
      );
      if (!r.ok || !r.body.copied_adset_id) {
        fail(r.ok ? "Meta didn't say what it made." : r.error);
        break;
      }
      made[step.ref] = r.body.copied_adset_id;
      result.done.push(withUrl(creds, { key: step.key, level: "adset", id: made[step.ref], name: step.name, what: "made", fromId: step.fromId }));
      await save(result);
      const src = p.adsets[Number(step.key.slice(1))];
      if (src && src.mode === "new" && src.name !== src.fromName) {
        const n = await graphPost(creds, encodeURIComponent(made[step.ref]), { name: step.name }, "name ad set copy");
        if (!n.ok) {
          fail(`The copy was made but couldn't be renamed: ${n.error}`);
          break;
        }
      }
    } else if (step.op === "copy_ad") {
      const parent = resolveRef(step.parent, made);
      if (!parent) {
        fail("Its ad set wasn't made.");
        break;
      }
      const r = await graphPost<{ copied_ad_id?: string }>(creds, `${encodeURIComponent(step.fromId)}/copies`, { adset_id: parent, status_option: "PAUSED", rename_options: NO_RENAME }, "copy ad");
      if (!r.ok || !r.body.copied_ad_id) {
        fail(r.ok ? "Meta didn't say what it made." : r.error);
        break;
      }
      made[step.ref] = r.body.copied_ad_id;
      result.done.push(withUrl(creds, { key: step.key, level: "ad", id: made[step.ref], name: step.name, what: "made", fromId: step.fromId }));
      await save(result);
      // Its own name, so the CRM credits its leads to it and not the original.
      const n = await graphPost(creds, encodeURIComponent(made[step.ref]), { name: step.name }, "name ad copy");
      if (!n.ok) {
        fail(`The copy was made but couldn't be renamed (the CRM can't tell it from the original until it is): ${n.error}`);
        break;
      }
    } else if (step.op === "budget") {
      const target = resolveRef(step.target, made);
      if (!target) {
        fail("What it belongs to wasn't made.");
        break;
      }
      const r = await graphPost(creds, encodeURIComponent(target), { daily_budget: String(step.cents) }, `${step.level} budget on copy`);
      if (!r.ok) {
        fail(r.error);
        break;
      }
      result.done.push(withUrl(creds, { key: step.key, level: step.level, id: target, name: step.level === "campaign" ? p.campaign.name : (p.adsets[Number(step.key.slice(1).split(":")[0])]?.name ?? "the ad set"), what: "budget", before: null }));
      await save(result);
    } else {
      const target = resolveRef(step.target, made);
      if (!target) {
        fail("It wasn't made.");
        break;
      }
      const r = await graphPost(creds, encodeURIComponent(target), { status: step.to }, `turn on ${step.level} copy`);
      if (!r.ok) {
        fail(r.error);
        break;
      }
      result.done.push(withUrl(creds, { key: step.key, level: step.level, id: target, name: step.name, what: "on", before: "PAUSED" }));
      await save(result);
    }
  }
  result.ok = !result.failed;
  const nothingChanged = !result.done.length;
  return { result, nothingChanged, error: result.failed ? failText(result, nothingChanged) : null };
}

function stepLabel(step: ReturnType<typeof copySteps>[number]): string {
  switch (step.op) {
    case "copy_campaign":
      return `copying the campaign as “${step.name}”`;
    case "copy_adset":
      return `copying ad set “${step.name}”`;
    case "copy_ad":
      return `copying ad “${step.name}”`;
    case "budget":
      return `setting the ${step.level === "campaign" ? "campaign" : "ad set"} budget to ${money0(step.cents)}`;
    default:
      return `turning on “${step.name}”`;
  }
}

function failText(r: MetaResult, nothingChanged: boolean): string {
  const f = r.failed;
  if (!f) return "";
  return nothingChanged ? `Meta said no while ${f.step.startsWith("“") ? `changing ${f.step}` : f.step}: ${f.error}` : `It stopped part-way, while ${f.step.startsWith("“") ? `changing ${f.step}` : f.step}: ${f.error} What was done is listed on the card — Undo takes it back.`;
}

/** The page shows a change at once: an ad's on/off is patched in; anything bigger makes the next load ask Meta. */
async function refreshCache(ownerId: string, accountId: string, kind: MetaKind, r: MetaResult, budget: MetaBudgetPayload | null) {
  const flips = r.done.filter((d) => d.what === "on" || d.what === "off");
  if (kind === "meta_status" && flips.length && flips.every((d) => d.level === "ad")) {
    await patchBase(ownerId, accountId, (b) => {
      for (const d of flips) {
        const ad = b.ads.find((a) => a.id === d.id);
        if (!ad) continue;
        ad.status = d.what === "on" ? "ACTIVE" : "PAUSED";
        if (d.what === "off") ad.effective_status = "PAUSED";
        else {
          const set = b.adsets.find((s) => s.id === ad.adset_id);
          ad.effective_status = set?.effective_status === "ACTIVE" ? "ACTIVE" : set?.effective_status === "CAMPAIGN_PAUSED" ? "CAMPAIGN_PAUSED" : "ADSET_PAUSED";
        }
      }
    });
    return;
  }
  if (kind === "meta_budget" && budget && r.done.some((x) => x.what === "budget")) {
    await patchBase(ownerId, accountId, (b) => {
      const list: { id: string; daily_budget?: string }[] = budget.level === "campaign" ? b.campaigns : b.adsets;
      const n = list.find((x) => x.id === budget.id);
      if (n) n.daily_budget = String(budget.afterCents);
    });
    return;
  }
  await staleBase(ownerId, accountId);
}

// ── Undo ──────────────────────────────────────────────────

export interface UndoOutcome {
  /** Lines for the card ("Turned “X” back on"). */
  done: string[];
  /** Ids handled (a retry skips them). */
  ids: string[];
  error: string | null;
  /** Nothing could be undone. */
  nothing: boolean;
}

export async function runMetaUndo(o: { ownerId: string; accountId: string; kind: MetaKind; payload: MetaPayload }): Promise<UndoOutcome> {
  const creds = manageCreds(o.accountId);
  if (!creds) return { done: [], ids: [], error: NOT_ON, nothing: true };
  const prev = o.payload.result?.undo;
  const handled = new Set((prev as { ids?: string[] } | null | undefined)?.ids ?? []);
  const done: string[] = [...(prev?.done ?? [])];
  const ids: string[] = [...handled];
  let error: string | null = null;
  const r = o.payload.result;
  // Nothing was changed (e.g. the request died before the first step): closing it is the undo.
  if (!r || !r.done.some((d) => d.what !== "already")) return { done: [...done, "Nothing had been changed in Meta."], ids, error: null, nothing: false };

  if (o.kind === "meta_status") {
    for (const d of r.done.filter((x) => (x.what === "on" || x.what === "off") && !handled.has(x.id))) {
      const set = d.what === "on" ? "ACTIVE" : "PAUSED";
      const back = d.before === "ACTIVE" ? "ACTIVE" : "PAUSED";
      const cur = await readNode<NodeState>(creds, d.id, "status", "read for undo");
      if (!cur.ok) {
        error = `Couldn't read “${d.name}”: ${cur.error}`;
        break;
      }
      if (cur.body.status !== set) {
        done.push(`“${d.name}” was changed again since — left as it is`);
        ids.push(d.id);
        continue;
      }
      const w = await graphPost(creds, encodeURIComponent(d.id), { status: back }, "undo status");
      if (!w.ok) {
        error = `Couldn't change “${d.name}” back: ${w.error}`;
        break;
      }
      done.push(`Turned “${d.name}” back ${back === "ACTIVE" ? "on" : "off"}`);
      ids.push(d.id);
    }
  } else if (o.kind === "meta_budget") {
    const p = o.payload as MetaBudgetPayload;
    const cur = await readNode<NodeState>(creds, p.id, "daily_budget", "read budget for undo");
    if (!cur.ok) error = `Couldn't read the budget: ${cur.error}`;
    else if (Number(cur.body.daily_budget ?? 0) !== p.afterCents) error = `It's ${money0(Number(cur.body.daily_budget ?? 0))} a day now — it was changed again since, so undo won't overwrite that.`;
    else {
      const w = await graphPost(creds, encodeURIComponent(p.id), { daily_budget: String(p.beforeCents) }, "undo budget");
      if (!w.ok) error = `Meta didn't take it: ${w.error}`;
      else {
        done.push(`Put “${p.name}” back to ${money0(p.beforeCents)} a day`);
        ids.push(p.id);
      }
    }
  } else {
    for (const t of copyUndoTargets(o.payload as MetaCopyPayload).filter((x) => !handled.has(x.id))) {
      const spent = await graphGet<{ data?: { spend?: string }[]; error?: GraphError }>(
        graphUrl(creds, `${encodeURIComponent(t.id)}/insights`, { fields: "spend", date_preset: "maximum" }),
        creds.token,
        "copy spend for undo"
      );
      const spendCents = spent.ok ? Math.round(Number(spent.body.data?.[0]?.spend ?? 0) * 100) : null;
      if (spendCents === 0) {
        const w = await graphPost(creds, encodeURIComponent(t.id), { status: "DELETED" }, "remove copy");
        if (!w.ok) {
          error = `Couldn't remove “${t.name}”: ${w.error}`;
          break;
        }
        done.push(`Removed “${t.name}” (it never spent)`);
      } else {
        const w = await graphPost(creds, encodeURIComponent(t.id), { status: "PAUSED" }, "pause copy");
        if (!w.ok) {
          error = `Couldn't turn off “${t.name}”: ${w.error}`;
          break;
        }
        done.push(spendCents === null ? `Turned “${t.name}” off (kept — couldn't check its spend)` : `Turned “${t.name}” off (kept for its numbers — it spent ${money0(spendCents)})`);
      }
      ids.push(t.id);
    }
  }
  const nothing = done.length === (prev?.done ?? []).length;
  if (!nothing) await staleBase(o.ownerId, o.accountId);
  return { done, ids, error, nothing };
}

export type { MetaDone };
