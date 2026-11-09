import type { EntityThen, SnapshotSummary } from "@/lib/ads/pack";
import type { ParsedRefresh, ParsedTarget } from "@/lib/ads/parse";

/**
 * Did a step's change show up in Meta? Read-only comparison of the step's
 * targets now against how they looked when the step was made (pure).
 */
export type Verification = { state: "verified" | "partly" | "not_yet" | "unknown"; detail: string };

interface StepLike {
  kind: string;
  createdAt: Date | string;
  targets: ParsedTarget[];
  budgetChange: { fromCents: number | null; toCents: number | null } | null;
  creativeRefresh: ParsedRefresh | null;
}

const find = (now: SnapshotSummary, level: string, id: string | null): EntityThen | null => {
  if (!id) return null;
  const list = level === "campaign" ? now.campaigns : level === "adset" ? now.adsets : level === "ad" ? now.ads : [];
  return list.find((e) => e.id === id) ?? null;
};

export function verifyStep(step: StepLike, now: SnapshotSummary | null): Verification | null {
  if (!now) return null;
  const since = new Date(step.createdAt).getTime();
  const targets = step.targets.filter((t) => t.id && t.level !== "account");

  if (step.kind === "pause") {
    const ents = targets.map((t) => find(now, t.level, t.id)).filter((e): e is EntityThen => Boolean(e));
    if (!ents.length) return { state: "unknown", detail: "Couldn't find the targets in Meta" };
    const off = ents.filter((e) => e.status !== "ACTIVE");
    if (off.length === ents.length) return { state: "verified", detail: "Paused in Meta" };
    return off.length ? { state: "partly", detail: `${off.length} of ${ents.length} paused` } : { state: "not_yet", detail: "Still running in Meta" };
  }

  if (step.kind === "scale_budget" || step.kind === "reduce_budget" || step.kind === "reallocate_budget") {
    const to = step.budgetChange?.toCents ?? null;
    const from = step.budgetChange?.fromCents ?? null;
    const ent = targets.map((t) => find(now, t.level, t.id)).find((e) => e && e.dailyBudgetCents !== null) ?? null;
    if (!ent || ent.dailyBudgetCents === null) return { state: "unknown", detail: "No daily budget to compare" };
    if (to !== null && Math.abs(ent.dailyBudgetCents - to) <= Math.max(100, to * 0.05)) return { state: "verified", detail: "Budget changed in Meta" };
    if (from !== null && to !== null && Math.sign(ent.dailyBudgetCents - from) === Math.sign(to - from) && ent.dailyBudgetCents !== from) {
      return { state: "partly", detail: "Budget moved the advised way" };
    }
    return { state: "not_yet", detail: "Budget unchanged in Meta" };
  }

  if (step.kind === "refresh_creatives") {
    const want = step.creativeRefresh?.count ?? 1;
    const scope = new Set(targets.map((t) => t.id));
    const fresh = now.ads.filter((a) => {
      if (!a.createdTime || new Date(a.createdTime).getTime() < since) return false;
      if (!scope.size) return true;
      const set = now.adsets.find((s) => s.id === a.parentId);
      return scope.has(a.parentId) || (set ? scope.has(set.parentId) : false) || scope.has(a.id);
    }).length;
    if (fresh >= want) return { state: "verified", detail: `${fresh} new ad${fresh > 1 ? "s" : ""} in Meta` };
    return fresh ? { state: "partly", detail: `${fresh} of ${want} new ads in Meta` } : { state: "not_yet", detail: "No new ads yet" };
  }

  if (step.kind === "launch_test") {
    const fresh = now.adsets.filter((a) => a.createdTime && new Date(a.createdTime).getTime() >= since).length;
    return fresh ? { state: "verified", detail: `${fresh} new ad set${fresh > 1 ? "s" : ""}` } : { state: "not_yet", detail: "No new ad set yet" };
  }

  if (step.kind === "fix_tracking") {
    const live = now.ads.filter((a) => a.status === "ACTIVE" && a.hasUtm !== null);
    if (!live.length) return { state: "unknown", detail: "Nothing to check" };
    const missing = live.filter((a) => a.hasUtm === false).length;
    return missing ? { state: "not_yet", detail: `${missing} live ad${missing > 1 ? "s" : ""} still without utm_content` } : { state: "verified", detail: "Every live ad has utm_content" };
  }

  return null;
}
