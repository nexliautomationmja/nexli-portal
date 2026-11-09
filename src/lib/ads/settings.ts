import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { adSettings } from "@/lib/ads/tables";

/** Goals and preferences for an ad account (one row, created on first read). */

export type AdSettingsRow = typeof adSettings.$inferSelect;

export interface AdSettingsView {
  targetCpbCents: number | null;
  targetCplCents: number | null;
  monthlyBudgetCents: number | null;
  maxCacCents: number | null;
  context: string;
  weeklyAuto: boolean;
  agentProfile: "standard" | "max";
  notifyEmail: boolean;
  studioKey: string;
  connector: { id: string | null; name: string | null; checkedAt: string } | null;
  lastCronAt: string | null;
}

export async function getSettings(ownerId: string, accountId: string): Promise<AdSettingsRow> {
  const [row] = await db
    .select()
    .from(adSettings)
    .where(and(eq(adSettings.ownerId, ownerId), eq(adSettings.accountId, accountId)))
    .limit(1);
  if (row) return row;
  const [created] = await db.insert(adSettings).values({ ownerId, accountId }).onConflictDoNothing().returning();
  if (created) return created;
  const [again] = await db
    .select()
    .from(adSettings)
    .where(and(eq(adSettings.ownerId, ownerId), eq(adSettings.accountId, accountId)))
    .limit(1);
  return again;
}

export function settingsView(s: AdSettingsRow): AdSettingsView {
  return {
    targetCpbCents: s.targetCpbCents,
    targetCplCents: s.targetCplCents,
    monthlyBudgetCents: s.monthlyBudgetCents,
    maxCacCents: s.maxCacCents,
    context: s.context,
    weeklyAuto: s.weeklyAuto,
    agentProfile: s.agentProfile === "max" ? "max" : "standard",
    notifyEmail: s.notifyEmail,
    studioKey: s.studioKey,
    connector: s.manusConnector ?? null,
    lastCronAt: s.lastCronAt ? s.lastCronAt.toISOString() : null,
  };
}

const usd = (v: unknown): number | null | undefined => {
  if (v === null || v === "") return null;
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n * 100) : null;
};

/** PUT body → column changes (USD in, cents stored). */
export function settingsPatch(body: Record<string, unknown>): Partial<typeof adSettings.$inferInsert> {
  const p: Partial<typeof adSettings.$inferInsert> = {};
  const cpb = usd(body.targetCostPerBookedUsd);
  const cpl = usd(body.targetCplUsd);
  const budget = usd(body.monthlyBudgetUsd);
  const cac = usd(body.maxCacUsd);
  if (cpb !== undefined) p.targetCpbCents = cpb;
  if (cpl !== undefined) p.targetCplCents = cpl;
  if (budget !== undefined) p.monthlyBudgetCents = budget;
  if (cac !== undefined) p.maxCacCents = cac;
  if (typeof body.context === "string") p.context = body.context.slice(0, 2000);
  if (typeof body.weeklyAuto === "boolean") p.weeklyAuto = body.weeklyAuto;
  if (body.agentProfile === "standard" || body.agentProfile === "max") p.agentProfile = body.agentProfile;
  if (typeof body.notifyEmail === "boolean") p.notifyEmail = body.notifyEmail;
  return p;
}
