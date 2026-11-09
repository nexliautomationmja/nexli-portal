/** Display formatting for the Ads tab, the data pack and emails (pure, client-safe). */

export function money(cents: number | null | undefined, opts: { exact?: boolean } = {}): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  const digits = opts.exact || abs < 100 ? 2 : 0;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Compact money for tight spots: $1.2K, $34K, $1.4M. */
export function moneyShort(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  const d = cents / 100;
  const abs = Math.abs(d);
  if (abs >= 1_000_000) return `$${(d / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `$${Math.round(d / 1000)}K`;
  if (abs >= 1000) return `$${(d / 1000).toFixed(1)}K`;
  return `$${Math.round(d)}`;
}

export function pct(rate: number | null | undefined, digits?: number): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
  const v = rate * 100;
  const d = digits ?? (Math.abs(v) < 10 ? (Math.abs(v) < 1 ? 2 : 1) : 0);
  return `${v.toFixed(d)}%`;
}

export function count(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function countShort(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${Math.round(n / 1000)}K`;
  if (a >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

export const decimal = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toFixed(d);

/** Signed relative change: "+12%" / "−8%". */
export function change(r: number | null | undefined): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return "—";
  const v = Math.round(r * 100);
  if (v === 0) return "0%";
  return `${v > 0 ? "+" : "−"}${Math.abs(v)}%`;
}

export const multiple = (x: number | null | undefined) =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : `${x >= 10 ? Math.round(x) : x.toFixed(1)}×`;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CAMPAIGN_PAUSED: "Campaign paused",
  ADSET_PAUSED: "Ad set paused",
  DELETED: "Deleted",
  ARCHIVED: "Archived",
  IN_PROCESS: "In process",
  WITH_ISSUES: "With issues",
  DISAPPROVED: "Disapproved",
  PENDING_REVIEW: "In review",
  PREAPPROVED: "Pre-approved",
  PENDING_BILLING_INFO: "Billing info needed",
};
export const statusLabel = (s: string | null | undefined) =>
  s ? (STATUS_LABEL[s] ?? s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())) : "—";

export const isActive = (effectiveStatus: string | null | undefined) => effectiveStatus === "ACTIVE";
