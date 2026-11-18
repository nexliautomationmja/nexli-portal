/**
 * Changes in Meta from the Ads page (client-safe, pure): what a card says it
 * will do, the checks that keep a typo from costing money, and the exact
 * steps the server runs when Marcel taps Apply (and to undo them).
 *
 * Nothing here talks to Meta. The server (meta-write.ts) runs the steps one
 * by one with the manage token and records each result on the change, so a
 * half-finished copy can always be seen and undone.
 */

export type MetaLevel = "campaign" | "adset" | "ad";
export type MetaStatus = "ACTIVE" | "PAUSED";

export const LEVEL_LABEL: Record<MetaLevel, string> = { campaign: "Campaign", adset: "Ad set", ad: "Ad" };

/** What happened when the steps ran (saved on the change after every step). */
export interface MetaResult {
  /** When Apply started (ISO). */
  at: string;
  /** Every step finished. */
  ok: boolean;
  /** What changed or was made, in order. */
  done: MetaDone[];
  /** The step that failed (nothing after it ran). */
  failed: { step: string; error: string } | null;
  undo?: { at: string; done: string[]; failed: string | null; ids?: string[] } | null;
}

export interface MetaDone {
  /** Step key (see MetaStep.key). */
  key: string;
  level: MetaLevel;
  id: string;
  name: string;
  /** "made" = a new copy; "on" / "off"; "budget"; "renamed"; "already" = it was already that way. */
  what: "made" | "on" | "off" | "budget" | "renamed" | "already";
  /** For "made": the object it was copied from. */
  fromId?: string;
  /** For "on" / "off" / "budget": the value before (so undo can put it back). */
  before?: string | number | null;
  /** Ads Manager link. */
  url?: string;
}

/** Can the page change Meta (GET /api/dashboard/ads/meta)? */
export interface MetaAccessView {
  configured: boolean;
  canWrite: boolean;
  problems: string[];
  notes: string[];
  checkedAt: string;
  steps: string[];
}

// ── Turn off / on ─────────────────────────────────────────

export interface MetaStatusTarget {
  level: MetaLevel;
  id: string;
  name: string;
  /** Its own on/off setting when the card was made. */
  before: MetaStatus;
}

export interface MetaStatusPayload {
  to: MetaStatus;
  targets: MetaStatusTarget[];
  /** e.g. "Its campaign is off, so it won't run until that's on too." */
  warnings: string[];
  /** Made from a Turn off button (not the chat). */
  from?: "plan" | "chat";
  result?: MetaResult;
}

// ── Budget ────────────────────────────────────────────────

export interface MetaBudgetPayload {
  level: "campaign" | "adset";
  id: string;
  name: string;
  beforeCents: number;
  afterCents: number;
  warnings: string[];
  result?: MetaResult;
}

// ── Copies and new campaigns ─────────────────────────────

export interface CopyAd {
  fromId: string;
  fromName: string;
  /** The copy's name (unique, so the CRM credits leads to the right ad). */
  name: string;
}

export type CopyCampaign = { mode: "new"; fromId: string; fromName: string; name: string; isCbo: boolean; dailyBudgetCents: number | null } | { mode: "existing"; id: string; name: string };

export type CopyAdset =
  | { mode: "new"; fromId: string; fromName: string; name: string; dailyBudgetCents: number | null; endTimeZero: boolean; ads: CopyAd[] }
  | { mode: "existing"; id: string; name: string; ads: CopyAd[] };

export interface MetaCopyPayload {
  what: "campaign" | "adset" | "ad" | "new_campaign";
  campaign: CopyCampaign;
  adsets: CopyAdset[];
  /** Turn everything that's made on at the end (only when every copy worked). */
  turnOn: boolean;
  /** Roughly what it spends per day once on (null when it can't be told). */
  dailyCents: number | null;
  warnings: string[];
  result?: MetaResult;
}

export type MetaPayload = MetaStatusPayload | MetaBudgetPayload | MetaCopyPayload;
export type MetaKind = "meta_status" | "meta_budget" | "meta_copy";
export const isMetaKind = (k: string): k is MetaKind => k === "meta_status" || k === "meta_budget" || k === "meta_copy";

// ── What the snapshot knows (minimal shapes, so tests can use fixtures) ──

export interface NodeCampaign {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  isCbo: boolean;
  dailyBudgetCents: number | null;
  lifetimeBudgetCents: number | null;
}
export interface NodeAdset {
  id: string;
  name: string;
  campaignId: string;
  status: string;
  effectiveStatus: string;
  dailyBudgetCents: number | null;
  lifetimeBudgetCents: number | null;
}
export interface NodeAd {
  id: string;
  name: string;
  adsetId: string;
  campaignId: string;
  status: string;
  effectiveStatus: string;
  spend30Cents: number;
}
export interface Structure {
  campaigns: NodeCampaign[];
  adsets: NodeAdset[];
  ads: NodeAd[];
}

const isOn = (status: string) => status === "ACTIVE";
const ownStatus = (status: string): MetaStatus => (status === "ACTIVE" ? "ACTIVE" : "PAUSED");
export const money0 = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ── Limits (a typo guard; the card shows everything else) ──

export const META_LIMITS = {
  maxTargets: 10,
  maxAdsetsPerCopy: 6,
  maxAdsPerCopy: 30,
  minDailyCents: 100,
  maxDailyCents: 500_000,
  /** A budget more than this many times the old one is refused (probably an extra 0). */
  maxJump: 5,
  /** At or above this change Meta usually restarts learning. */
  learningJump: 0.2,
};

// ── Finding things ────────────────────────────────────────

const norm = (x: string) => x.toLowerCase().replace(/[“”"'‘’]/g, "").replace(/\s+/g, " ").trim();

/** A campaign, ad set or ad by id or name (live ones first). Ambiguous names are an error with the ids to pick from. */
export function findNode<T extends { id: string; name: string; effectiveStatus: string }>(list: T[], ref: unknown, label: string): { node: T } | { error: string } {
  const q = String(ref ?? "").trim().replace(/^\[|\]$/g, "");
  if (!q) return { error: `No ${label} given.` };
  const byId = list.find((x) => x.id === q);
  if (byId) return { node: byId };
  const n = norm(q);
  const exact = list.filter((x) => norm(x.name) === n);
  const pool = exact.length ? exact : list.filter((x) => norm(x.name).includes(n));
  if (!pool.length) return { error: `No ${label} matches "${q}". Use an id from account_structure.` };
  if (pool.length === 1) return { node: pool[0] };
  const live = pool.filter((x) => isOn(x.effectiveStatus));
  if (live.length === 1) return { node: live[0] };
  return { error: `"${q}" matches ${pool.length} ${label}s: ${pool.slice(0, 6).map((x) => `[${x.id}] "${x.name}"`).join(", ")}. Use the id.` };
}

/** A name nobody else uses: "Name - Copy", then "Name - Copy 2", … (adds to `taken`). */
export function uniqueName(base: string, taken: Set<string>, suffix = "Copy"): string {
  const clean = base.replace(/\s+-\s+Copy(\s+\d+)?$/i, "").trim() || base;
  let name = `${clean} - ${suffix}`;
  for (let i = 2; taken.has(norm(name)); i++) name = `${clean} - ${suffix} ${i}`;
  taken.add(norm(name));
  return name;
}

// ── Budgets ───────────────────────────────────────────────

/** Is this budget change sane? A refusal is a probable typo; warnings go on the card. */
export function budgetCheck(o: { beforeCents: number | null; afterCents: number; accountDailyCents?: number | null; monthlyBudgetCents?: number | null }): { refuse: string | null; warnings: string[] } {
  const { beforeCents, afterCents } = o;
  if (!Number.isFinite(afterCents) || afterCents < META_LIMITS.minDailyCents) return { refuse: `A daily budget has to be at least ${money0(META_LIMITS.minDailyCents)}.`, warnings: [] };
  if (afterCents > META_LIMITS.maxDailyCents) return { refuse: `${money0(afterCents)} a day is above the ${money0(META_LIMITS.maxDailyCents)} limit set here — change it in Ads Manager if it's really meant.`, warnings: [] };
  if (beforeCents && afterCents > beforeCents * META_LIMITS.maxJump) {
    return { refuse: `${money0(afterCents)} is more than ${META_LIMITS.maxJump}× the ${money0(beforeCents)} it is now — probably a typo. Raise it in smaller steps, or in Ads Manager.`, warnings: [] };
  }
  const warnings: string[] = [];
  if (beforeCents && beforeCents > 0) {
    const jump = (afterCents - beforeCents) / beforeCents;
    if (Math.abs(jump) >= META_LIMITS.learningJump) {
      warnings.push(`A ${jump > 0 ? "+" : "−"}${Math.round(Math.abs(jump) * 100)}% change usually restarts Meta's learning — results can wobble for a few days.`);
    }
  }
  if (o.monthlyBudgetCents && o.accountDailyCents !== null && o.accountDailyCents !== undefined && beforeCents !== null) {
    const month = Math.round((o.accountDailyCents - beforeCents + afterCents) * 30.4);
    if (month > o.monthlyBudgetCents) warnings.push(`Puts the account at about ${money0(month)} a month — over the ${money0(o.monthlyBudgetCents)} budget in Goals.`);
  }
  return { refuse: null, warnings };
}

/** What the live account spends per day by its budgets (campaign budgets + ad set budgets of campaigns without one). */
export function accountDailyCents(st: Structure): number {
  let sum = 0;
  for (const c of st.campaigns) {
    if (!isOn(c.effectiveStatus)) continue;
    if (c.isCbo) sum += c.dailyBudgetCents ?? 0;
    else for (const a of st.adsets) if (a.campaignId === c.id && isOn(a.effectiveStatus)) sum += a.dailyBudgetCents ?? 0;
  }
  return sum;
}

export function planBudget(st: Structure, o: { level: "campaign" | "adset"; ref: unknown; dailyUsd: number; monthlyBudgetCents?: number | null }): { payload: MetaBudgetPayload; summary: string } | { error: string } {
  const afterCents = Math.round(Number(o.dailyUsd) * 100);
  if (o.level === "campaign") {
    const f = findNode(st.campaigns, o.ref, "campaign");
    if ("error" in f) return f;
    const c = f.node;
    if (!c.isCbo) return { error: `"${c.name}" doesn't have a campaign budget — its ad sets each have their own. Change an ad set's budget instead.` };
    if (c.lifetimeBudgetCents && !c.dailyBudgetCents) return { error: `"${c.name}" has a lifetime budget — change that in Ads Manager.` };
    const chk = budgetCheck({ beforeCents: c.dailyBudgetCents, afterCents, accountDailyCents: accountDailyCents(st), monthlyBudgetCents: isOn(c.effectiveStatus) ? o.monthlyBudgetCents : null });
    if (chk.refuse) return { error: chk.refuse };
    if (c.dailyBudgetCents === afterCents) return { error: `"${c.name}" is already at ${money0(afterCents)} a day.` };
    return {
      payload: { level: "campaign", id: c.id, name: c.name, beforeCents: c.dailyBudgetCents ?? 0, afterCents, warnings: chk.warnings },
      summary: `Campaign budget “${c.name}”: ${money0(c.dailyBudgetCents ?? 0)} → ${money0(afterCents)} a day`,
    };
  }
  const f = findNode(st.adsets, o.ref, "ad set");
  if ("error" in f) return f;
  const a = f.node;
  const camp = st.campaigns.find((c) => c.id === a.campaignId);
  if (camp?.isCbo) return { error: `"${a.name}" gets its budget from its campaign "${camp.name}" (campaign budget). Change the campaign's budget instead.` };
  if (a.lifetimeBudgetCents && !a.dailyBudgetCents) return { error: `"${a.name}" has a lifetime budget — change that in Ads Manager.` };
  const on = isOn(a.effectiveStatus);
  const chk = budgetCheck({ beforeCents: a.dailyBudgetCents, afterCents, accountDailyCents: accountDailyCents(st), monthlyBudgetCents: on ? o.monthlyBudgetCents : null });
  if (chk.refuse) return { error: chk.refuse };
  if (a.dailyBudgetCents === afterCents) return { error: `"${a.name}" is already at ${money0(afterCents)} a day.` };
  return {
    payload: { level: "adset", id: a.id, name: a.name, beforeCents: a.dailyBudgetCents ?? 0, afterCents, warnings: chk.warnings },
    summary: `Ad set budget “${a.name}”: ${money0(a.dailyBudgetCents ?? 0)} → ${money0(afterCents)} a day`,
  };
}

// ── Off / on ──────────────────────────────────────────────

export function planStatus(st: Structure, o: { to: MetaStatus; targets: { level: MetaLevel; ref: unknown }[]; from?: "plan" | "chat" }): { payload: MetaStatusPayload; summary: string; adId: string | null } | { error: string } {
  if (!o.targets.length) return { error: "Nothing to turn on or off." };
  if (o.targets.length > META_LIMITS.maxTargets) return { error: `At most ${META_LIMITS.maxTargets} at a time.` };
  const targets: MetaStatusTarget[] = [];
  const warnings: string[] = [];
  const already: string[] = [];
  for (const t of o.targets) {
    const list = t.level === "campaign" ? st.campaigns : t.level === "adset" ? st.adsets : st.ads;
    const f = findNode<{ id: string; name: string; status: string; effectiveStatus: string }>(list, t.ref, t.level === "adset" ? "ad set" : t.level);
    if ("error" in f) return f;
    const n = f.node;
    if (targets.some((x) => x.id === n.id)) continue;
    if (ownStatus(n.status) === o.to) {
      already.push(`"${n.name}" is already ${o.to === "ACTIVE" ? "on" : "off"}`);
      continue;
    }
    targets.push({ level: t.level, id: n.id, name: n.name, before: ownStatus(n.status) });
  }
  if (!targets.length) return { error: `${already.join("; ")} — nothing to change.` };
  if (o.to === "ACTIVE") {
    // Something turned on under a parent that's off won't run.
    for (const t of targets) {
      if (t.level === "ad") {
        const ad = st.ads.find((x) => x.id === t.id);
        const set = st.adsets.find((x) => x.id === ad?.adsetId);
        const camp = st.campaigns.find((x) => x.id === ad?.campaignId);
        const setTurning = set && targets.some((x) => x.id === set.id);
        const campTurning = camp && targets.some((x) => x.id === camp.id);
        if (set && !isOn(set.status) && !setTurning) warnings.push(`“${t.name}” won't run until its ad set “${set.name}” is on too.`);
        else if (camp && !isOn(camp.status) && !campTurning) warnings.push(`“${t.name}” won't run until its campaign “${camp.name}” is on too.`);
      }
      if (t.level === "adset") {
        const set = st.adsets.find((x) => x.id === t.id);
        const camp = st.campaigns.find((x) => x.id === set?.campaignId);
        if (camp && !isOn(camp.status) && !targets.some((x) => x.id === camp.id)) warnings.push(`“${t.name}” won't run until its campaign “${camp.name}” is on too.`);
        if (!st.ads.some((x) => x.adsetId === t.id && isOn(x.status))) warnings.push(`“${t.name}” has no ads turned on.`);
        if (set && !camp?.isCbo && set.dailyBudgetCents) warnings.push(`Starts spending about ${money0(set.dailyBudgetCents)} a day.`);
      }
      if (t.level === "campaign") {
        const camp = st.campaigns.find((x) => x.id === t.id);
        const sets = st.adsets.filter((x) => x.campaignId === t.id && isOn(x.status));
        if (!sets.length) warnings.push(`“${t.name}” has no ad sets turned on.`);
        const daily = camp?.isCbo ? camp.dailyBudgetCents : sets.reduce((s, x) => s + (x.dailyBudgetCents ?? 0), 0);
        if (daily) warnings.push(`Starts spending about ${money0(daily)} a day.`);
      }
    }
  } else {
    for (const t of targets) {
      if (t.level === "campaign") {
        const n = st.ads.filter((x) => x.campaignId === t.id && isOn(x.effectiveStatus)).length;
        if (n) warnings.push(`Stops all ${n} running ad${n === 1 ? "" : "s"} in “${t.name}”.`);
      }
      if (t.level === "adset") {
        const n = st.ads.filter((x) => x.adsetId === t.id && isOn(x.effectiveStatus)).length;
        if (n) warnings.push(`Stops all ${n} running ad${n === 1 ? "" : "s"} in “${t.name}”.`);
      }
    }
  }
  if (already.length) warnings.push(`${already.join("; ")}.`);
  const verb = o.to === "ACTIVE" ? "Turn on" : "Turn off";
  const summary =
    targets.length === 1 ? `${verb} ${LEVEL_LABEL[targets[0].level].toLowerCase()} “${targets[0].name}” in Meta` : `${verb} ${targets.length} in Meta: ${targets.slice(0, 3).map((t) => `“${t.name}”`).join(", ")}${targets.length > 3 ? "…" : ""}`;
  const adId = targets.length === 1 && targets[0].level === "ad" ? targets[0].id : null;
  return { payload: { to: o.to, targets, warnings, from: o.from ?? "chat" }, summary, adId };
}

// ── Copies ────────────────────────────────────────────────

const adsOf = (st: Structure, adsetId: string, include: "on" | "all") => {
  const all = st.ads.filter((a) => a.adsetId === adsetId);
  const on = all.filter((a) => isOn(a.status));
  return include === "all" || !on.length ? all : on;
};

function dailyOf(camp: CopyCampaign, sets: CopyAdset[], st: Structure): number | null {
  if (camp.mode === "new") {
    if (camp.isCbo) return camp.dailyBudgetCents;
    let sum = 0;
    for (const s of sets) if (s.mode === "new") sum += s.dailyBudgetCents ?? 0;
    return sum || null;
  }
  const c = st.campaigns.find((x) => x.id === camp.id);
  if (c?.isCbo) return null; // shares the existing campaign's budget
  let sum = 0;
  for (const s of sets) if (s.mode === "new") sum += s.dailyBudgetCents ?? 0;
  return sum || null;
}

/**
 * Duplicate a campaign (with its ad sets and ads), an ad set (into its own
 * campaign or another) or an ad (into its own ad set or another). Copies are
 * made paused; `turnOn` switches them on once everything is made.
 */
export function planDuplicate(
  st: Structure,
  o: { what: "campaign" | "adset" | "ad"; ref: unknown; into?: unknown; name?: string | null; dailyUsd?: number | null; turnOn?: boolean; include?: "on" | "all"; monthlyBudgetCents?: number | null }
): { payload: MetaCopyPayload; summary: string } | { error: string } {
  const taken = new Set(st.ads.map((a) => norm(a.name)));
  const takenSets = new Set(st.adsets.map((a) => norm(a.name)));
  const takenCamps = new Set(st.campaigns.map((c) => norm(c.name)));
  const include = o.include ?? "on";
  const budgetCents = o.dailyUsd !== null && o.dailyUsd !== undefined && Number(o.dailyUsd) > 0 ? Math.round(Number(o.dailyUsd) * 100) : null;
  const warnings: string[] = [];
  const turnOn = Boolean(o.turnOn);
  const customName = String(o.name ?? "").trim().slice(0, 200) || null;

  const copyAds = (list: NodeAd[]): CopyAd[] => list.map((a) => ({ fromId: a.id, fromName: a.name, name: uniqueName(a.name, taken) }));
  const checkBudget = (before: number | null): string | null => (budgetCents === null ? null : budgetCheck({ beforeCents: before, afterCents: budgetCents }).refuse);

  let payload: MetaCopyPayload;
  if (o.what === "campaign") {
    const f = findNode(st.campaigns, o.ref, "campaign");
    if ("error" in f) return f;
    const c = f.node;
    const setsAll = st.adsets.filter((a) => a.campaignId === c.id);
    const setsOn = setsAll.filter((a) => isOn(a.status));
    const sets = include === "all" || !setsOn.length ? setsAll : setsOn;
    if (!sets.length) return { error: `"${c.name}" has no ad sets to copy.` };
    if (sets.length > META_LIMITS.maxAdsetsPerCopy) return { error: `"${c.name}" has ${sets.length} ad sets — more than the ${META_LIMITS.maxAdsetsPerCopy} that can be copied at once. Copy the ad sets you want one by one.` };
    if (c.lifetimeBudgetCents && !c.dailyBudgetCents) return { error: `"${c.name}" has a lifetime budget — duplicate it in Ads Manager.` };
    if (budgetCents !== null && !c.isCbo && sets.length > 1) return { error: `"${c.name}" has budgets on its ${sets.length} ad sets — say which ad set's budget to change, or leave the budgets as they are.` };
    const refuse = checkBudget(c.isCbo ? c.dailyBudgetCents : sets[0].dailyBudgetCents);
    if (refuse) return { error: refuse };
    const campaign: CopyCampaign = { mode: "new", fromId: c.id, fromName: c.name, name: customName ?? uniqueName(c.name, takenCamps), isCbo: c.isCbo, dailyBudgetCents: c.isCbo ? (budgetCents ?? c.dailyBudgetCents) : null };
    const adsets: CopyAdset[] = sets.map((s) => ({
      mode: "new",
      fromId: s.id,
      fromName: s.name,
      name: s.name,
      dailyBudgetCents: c.isCbo ? null : (budgetCents ?? s.dailyBudgetCents),
      endTimeZero: Boolean(c.isCbo ? c.dailyBudgetCents : s.dailyBudgetCents),
      ads: copyAds(adsOf(st, s.id, include)),
    }));
    payload = { what: "campaign", campaign, adsets, turnOn, dailyCents: null, warnings };
  } else if (o.what === "adset") {
    const f = findNode(st.adsets, o.ref, "ad set");
    if ("error" in f) return f;
    const s = f.node;
    let target: NodeCampaign | undefined = st.campaigns.find((c) => c.id === s.campaignId);
    if (o.into !== undefined && o.into !== null && String(o.into).trim()) {
      const g = findNode(st.campaigns, o.into, "campaign");
      if ("error" in g) return g;
      target = g.node;
    }
    if (!target) return { error: "Couldn't find the campaign to copy it into." };
    if (s.lifetimeBudgetCents && !s.dailyBudgetCents && !target.isCbo) return { error: `"${s.name}" has a lifetime budget — duplicate it in Ads Manager.` };
    if (budgetCents !== null && target.isCbo) return { error: `"${target.name}" sets the budget for its ad sets (campaign budget) — change the campaign's budget instead.` };
    const refuse = checkBudget(s.dailyBudgetCents);
    if (refuse) return { error: refuse };
    const ads = adsOf(st, s.id, include);
    if (!ads.length) return { error: `"${s.name}" has no ads to copy.` };
    const sameCampaign = target.id === s.campaignId;
    const adsets: CopyAdset[] = [
      {
        mode: "new",
        fromId: s.id,
        fromName: s.name,
        name: customName ?? (sameCampaign ? uniqueName(s.name, takenSets) : s.name),
        dailyBudgetCents: target.isCbo ? null : (budgetCents ?? s.dailyBudgetCents),
        endTimeZero: Boolean(target.isCbo ? target.dailyBudgetCents : (budgetCents ?? s.dailyBudgetCents)),
        ads: copyAds(ads),
      },
    ];
    if (turnOn && !isOn(target.status)) warnings.push(`Its campaign “${target.name}” is off, so the copy won't run until that's on.`);
    if (target.id !== s.campaignId) {
      const from = st.campaigns.find((c) => c.id === s.campaignId);
      if (from && from.isCbo !== target.isCbo) warnings.push(`“${from.name}” and “${target.name}” handle budgets differently — Meta may refuse the copy.`);
    }
    payload = { what: "adset", campaign: { mode: "existing", id: target.id, name: target.name }, adsets, turnOn, dailyCents: null, warnings };
  } else {
    const f = findNode(st.ads, o.ref, "ad");
    if ("error" in f) return f;
    const a = f.node;
    let set: NodeAdset | undefined = st.adsets.find((x) => x.id === a.adsetId);
    if (o.into !== undefined && o.into !== null && String(o.into).trim()) {
      const g = findNode(st.adsets, o.into, "ad set");
      if ("error" in g) return g;
      set = g.node;
    }
    if (!set) return { error: "Couldn't find the ad set to copy it into." };
    if (budgetCents !== null) return { error: "Copying an ad doesn't change budgets — change the ad set's budget on its own." };
    const camp = st.campaigns.find((c) => c.id === set!.campaignId);
    if (!camp) return { error: "Couldn't find that ad set's campaign." };
    const ads: CopyAd[] = [{ fromId: a.id, fromName: a.name, name: customName ?? uniqueName(a.name, taken) }];
    if (turnOn && (!isOn(set.status) || !isOn(camp.status))) warnings.push(`“${set.name}” or its campaign is off, so the copy won't run until they're on.`);
    payload = { what: "ad", campaign: { mode: "existing", id: camp.id, name: camp.name }, adsets: [{ mode: "existing", id: set.id, name: set.name, ads }], turnOn, dailyCents: null, warnings };
  }

  const nAds = payload.adsets.reduce((s, x) => s + x.ads.length, 0);
  if (nAds > META_LIMITS.maxAdsPerCopy) return { error: `That's ${nAds} ads — more than the ${META_LIMITS.maxAdsPerCopy} that can be copied at once.` };
  payload.dailyCents = dailyOf(payload.campaign, payload.adsets, st);
  finishWarnings(payload, o.monthlyBudgetCents ?? null, st);
  return { payload, summary: copySummary(payload) };
}

/**
 * A new campaign made from one of Marcel's: the template campaign's settings,
 * one ad set copied from the template ad set (targeting, optimization, pixel),
 * and the ads he picks from anywhere in the account.
 */
export function planNewCampaign(
  st: Structure,
  o: { template: unknown; templateAdset?: unknown; name: string; dailyUsd: number; ads: unknown[]; turnOn?: boolean; monthlyBudgetCents?: number | null }
): { payload: MetaCopyPayload; summary: string } | { error: string } {
  const f = findNode(st.campaigns, o.template, "campaign");
  if ("error" in f) return f;
  const c = f.node;
  let set: NodeAdset | undefined;
  if (o.templateAdset !== undefined && o.templateAdset !== null && String(o.templateAdset).trim()) {
    const g = findNode(st.adsets.filter((a) => a.campaignId === c.id), o.templateAdset, "ad set in that campaign");
    if ("error" in g) return g;
    set = g.node;
  } else {
    const sets = st.adsets.filter((a) => a.campaignId === c.id);
    const spend = (id: string) => st.ads.filter((a) => a.adsetId === id).reduce((s, a) => s + a.spend30Cents, 0);
    set = [...sets].sort((a, b) => Number(isOn(b.status)) - Number(isOn(a.status)) || spend(b.id) - spend(a.id))[0];
  }
  if (!set) return { error: `"${c.name}" has no ad set to copy the targeting from.` };
  const name = String(o.name ?? "").trim().slice(0, 200);
  if (!name) return { error: "The new campaign needs a name." };
  if (st.campaigns.some((x) => norm(x.name) === norm(name))) return { error: `A campaign called "${name}" already exists — pick another name.` };
  const budgetCents = Math.round(Number(o.dailyUsd) * 100);
  const chk = budgetCheck({ beforeCents: null, afterCents: budgetCents });
  if (chk.refuse) return { error: chk.refuse };
  if (c.lifetimeBudgetCents && !c.dailyBudgetCents) return { error: `"${c.name}" has a lifetime budget — use a campaign with a daily budget as the template.` };
  if (!o.ads.length) return { error: "Pick at least one ad to put in it." };
  const taken = new Set(st.ads.map((a) => norm(a.name)));
  const ads: CopyAd[] = [];
  for (const ref of o.ads) {
    const g = findNode(st.ads, ref, "ad");
    if ("error" in g) return g;
    if (ads.some((x) => x.fromId === g.node.id)) continue;
    ads.push({ fromId: g.node.id, fromName: g.node.name, name: uniqueName(g.node.name, taken) });
  }
  if (ads.length > META_LIMITS.maxAdsPerCopy) return { error: `At most ${META_LIMITS.maxAdsPerCopy} ads.` };
  const payload: MetaCopyPayload = {
    what: "new_campaign",
    campaign: { mode: "new", fromId: c.id, fromName: c.name, name, isCbo: c.isCbo, dailyBudgetCents: c.isCbo ? budgetCents : null },
    adsets: [{ mode: "new", fromId: set.id, fromName: set.name, name: set.name, dailyBudgetCents: c.isCbo ? null : budgetCents, endTimeZero: true, ads }],
    turnOn: Boolean(o.turnOn),
    dailyCents: budgetCents,
    warnings: [],
  };
  const fromOther = ads.filter((a) => st.ads.find((x) => x.id === a.fromId)?.campaignId !== c.id).length;
  if (fromOther) payload.warnings.push(`${fromOther} of the ads come${fromOther === 1 ? "s" : ""} from other campaigns — Meta refuses an ad whose setup doesn't fit this ad set's goal; the card will say which.`);
  finishWarnings(payload, o.monthlyBudgetCents ?? null, st);
  return { payload, summary: copySummary(payload) };
}

function finishWarnings(p: MetaCopyPayload, monthlyBudgetCents: number | null, st: Structure) {
  if (p.turnOn && p.dailyCents) {
    p.warnings.push(`Goes live as soon as it's made — about ${money0(p.dailyCents)} a day, and a new ad set starts in Meta's learning phase.`);
    if (monthlyBudgetCents) {
      const month = Math.round((accountDailyCents(st) + p.dailyCents) * 30.4);
      if (month > monthlyBudgetCents) p.warnings.push(`Puts the account at about ${money0(month)} a month — over the ${money0(monthlyBudgetCents)} budget in Goals.`);
    }
  } else if (!p.turnOn) {
    p.warnings.push("Made paused — nothing spends until it's turned on.");
  }
}

export function copySummary(p: MetaCopyPayload): string {
  const nAds = p.adsets.reduce((s, x) => s + x.ads.length, 0);
  const live = p.turnOn ? " and turn it on" : " (paused)";
  if (p.what === "new_campaign" && p.campaign.mode === "new") return `New campaign “${p.campaign.name}” from “${p.campaign.fromName}” with ${nAds} ad${nAds === 1 ? "" : "s"}${p.dailyCents ? ` at ${money0(p.dailyCents)} a day` : ""}${live}`;
  if (p.what === "campaign" && p.campaign.mode === "new") return `Duplicate campaign “${p.campaign.fromName}” → “${p.campaign.name}” (${p.adsets.length} ad set${p.adsets.length === 1 ? "" : "s"}, ${nAds} ad${nAds === 1 ? "" : "s"})${live}`;
  const s = p.adsets[0];
  if (p.what === "adset" && s?.mode === "new") return `Duplicate ad set “${s.fromName}” into “${p.campaign.name}” with ${nAds} ad${nAds === 1 ? "" : "s"}${live}`;
  const ad = s?.ads[0];
  return `Duplicate ad “${ad?.fromName ?? "?"}” into “${s?.name ?? "?"}”${live}`;
}

// ── The steps the server runs ─────────────────────────────

/**
 * One step. `ref` names what it makes ("@c" the campaign, "@s0" ad set 0,
 * "@s0a1" its ad 1 — never a real id, which is all digits); `parent` /
 * `target` is a ref or a real id. `key` is the ref without the "@" (what the
 * result records).
 */
export type MetaStep =
  | { key: string; op: "copy_campaign"; ref: "@c"; fromId: string; name: string }
  | { key: string; op: "copy_adset"; ref: string; fromId: string; parent: string; name: string; endTimeZero: boolean }
  | { key: string; op: "copy_ad"; ref: string; fromId: string; parent: string; name: string }
  | { key: string; op: "budget"; level: "campaign" | "adset"; target: string; cents: number }
  | { key: string; op: "status"; level: MetaLevel; target: string; to: MetaStatus; name: string };

export function copySteps(p: MetaCopyPayload): MetaStep[] {
  const steps: MetaStep[] = [];
  const campRef = p.campaign.mode === "new" ? "@c" : p.campaign.id;
  if (p.campaign.mode === "new") {
    steps.push({ key: "c", op: "copy_campaign", ref: "@c", fromId: p.campaign.fromId, name: p.campaign.name });
    if (p.campaign.isCbo && p.campaign.dailyBudgetCents) steps.push({ key: "c:budget", op: "budget", level: "campaign", target: "@c", cents: p.campaign.dailyBudgetCents });
  }
  p.adsets.forEach((s, i) => {
    const setRef = s.mode === "new" ? `@s${i}` : s.id;
    if (s.mode === "new") {
      steps.push({ key: `s${i}`, op: "copy_adset", ref: `@s${i}`, fromId: s.fromId, parent: campRef, name: s.name, endTimeZero: s.endTimeZero });
      if (s.dailyBudgetCents) steps.push({ key: `s${i}:budget`, op: "budget", level: "adset", target: `@s${i}`, cents: s.dailyBudgetCents });
    }
    s.ads.forEach((a, j) => steps.push({ key: `s${i}a${j}`, op: "copy_ad", ref: `@s${i}a${j}`, fromId: a.fromId, parent: setRef, name: a.name }));
  });
  if (p.turnOn) {
    // Bottom up, so nothing half-made ever runs.
    p.adsets.forEach((s, i) => s.ads.forEach((a, j) => steps.push({ key: `s${i}a${j}:on`, op: "status", level: "ad", target: `@s${i}a${j}`, to: "ACTIVE", name: a.name })));
    p.adsets.forEach((s, i) => {
      if (s.mode === "new") steps.push({ key: `s${i}:on`, op: "status", level: "adset", target: `@s${i}`, to: "ACTIVE", name: s.name });
    });
    if (p.campaign.mode === "new") steps.push({ key: "c:on", op: "status", level: "campaign", target: "@c", to: "ACTIVE", name: p.campaign.name });
  }
  return steps;
}

/** A step's target as a real id ("@c" → the copy's id), or null when what it needs wasn't made. */
export function resolveRef(ref: string, made: Record<string, string>): string | null {
  if (ref.startsWith("@")) return made[ref] ?? null;
  return ref;
}

/**
 * What undoing a copy removes: the topmost things it made (a new campaign
 * takes its ad sets and ads with it). Things it never made are left alone.
 */
export function copyUndoTargets(p: MetaCopyPayload): { level: MetaLevel; id: string; name: string }[] {
  const done = p.result?.done ?? [];
  const made = (key: string) => done.find((d) => d.key === key && d.what === "made");
  const c = made("c");
  if (c) return [{ level: "campaign", id: c.id, name: c.name }];
  const out: { level: MetaLevel; id: string; name: string }[] = [];
  p.adsets.forEach((s, i) => {
    const set = made(`s${i}`);
    if (set) out.push({ level: "adset", id: set.id, name: set.name });
    else s.ads.forEach((_, j) => {
      const ad = made(`s${i}a${j}`);
      if (ad) out.push({ level: "ad", id: ad.id, name: ad.name });
    });
  });
  return out;
}

/** The card's one-line result ("Made 1 campaign, 1 ad set and 4 ads · all on"). */
export function resultLine(kind: MetaKind, p: MetaPayload): string | null {
  const r = p.result;
  if (!r) return null;
  if (kind === "meta_copy") {
    const made = r.done.filter((d) => d.what === "made");
    const n = (lvl: MetaLevel) => made.filter((d) => d.level === lvl).length;
    const parts = [n("campaign") ? `${n("campaign")} campaign` : null, n("adset") ? `${n("adset")} ad set${n("adset") === 1 ? "" : "s"}` : null, n("ad") ? `${n("ad")} ad${n("ad") === 1 ? "" : "s"}` : null].filter(Boolean);
    const on = r.done.some((d) => d.what === "on");
    return parts.length ? `Made ${parts.join(", ")}${r.ok ? (on ? " · turned on" : " · paused") : ""}` : null;
  }
  if (kind === "meta_status") {
    const changed = r.done.filter((d) => d.what === "on" || d.what === "off").length;
    const already = r.done.filter((d) => d.what === "already").length;
    return [changed ? `${changed} changed in Meta` : null, already ? `${already} already that way` : null].filter(Boolean).join(" · ") || null;
  }
  return r.ok ? "Budget changed in Meta" : null;
}
