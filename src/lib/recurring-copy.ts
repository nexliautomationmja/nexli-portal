/**
 * One-time charges inside a recurring invoice (Nov 16 2026): the client's
 * chosen AI avatar ($2,500) rides on their first monthly DRS invoice, which
 * is also the recurring parent. The parent's metadata.oneTimeCents marks it,
 * and its line(s) carry billingType "one_time". Later months — the recurring
 * cron's copies, autopay's monthly receipts, autopay's monthly price and
 * MRR — must leave them out.
 *
 * Gated on metadata.oneTimeCents: line billingType defaults to "one_time" in
 * the schema, so older recurring invoices may carry it on lines that DO
 * repeat. Pure and client-safe.
 */

/** The one-time portion of a recurring invoice, in cents (0 when none). */
export function oneTimeCentsOf(metadata: unknown): number {
  const raw = (metadata as { oneTimeCents?: unknown } | null)?.oneTimeCents;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** True for a line that's charged once only, on the parent invoice itself. */
export function isOneTimeLine(metadata: unknown, line: { billingType?: string | null }): boolean {
  return oneTimeCentsOf(metadata) > 0 && line.billingType === "one_time";
}

/**
 * What a later month copies from a recurring parent: the one-time lines
 * dropped, their amount taken off the totals, and the one-time tags removed
 * from the metadata. Parents without one-time charges come back unchanged.
 */
export function recurringCopyOf<L extends { billingType?: string | null }>(
  parent: { total: number; subtotal: number; metadata: unknown },
  lines: L[]
): { total: number; subtotal: number; metadata: unknown; lines: L[] } {
  const oneTime = oneTimeCentsOf(parent.metadata);
  if (!oneTime) return { total: parent.total, subtotal: parent.subtotal, metadata: parent.metadata, lines };
  const meta = { ...((parent.metadata ?? {}) as Record<string, unknown>) };
  delete meta.oneTimeCents;
  delete meta.aiAvatar;
  return {
    total: Math.max(0, parent.total - oneTime),
    subtotal: Math.max(0, parent.subtotal - oneTime),
    metadata: meta,
    lines: lines.filter((l) => l.billingType !== "one_time"),
  };
}
