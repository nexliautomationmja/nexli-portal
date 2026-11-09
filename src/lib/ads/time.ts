/**
 * Dates for the Ads tab, in the ad account's timezone (pure, client-safe).
 * Windows end yesterday (complete days), like Ads Manager's "Last N days".
 */

export const DEFAULT_TZ = "America/Chicago";

function partsIn(d: Date, tz: string): Record<string, number> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type === "weekday") out.weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.value);
    else if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

/** A valid IANA zone, else the default. */
export function safeTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** YYYY-MM-DD of `d` in `tz`. */
export function localDate(d: Date, tz: string): string {
  const p = partsIn(d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

const ymdUtc = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDays(ymd: string, n: number): string {
  return new Date(ymdUtc(ymd) + n * 86400000).toISOString().slice(0, 10);
}

/** Whole days from a to b (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((ymdUtc(b) - ymdUtc(a)) / 86400000);

/** Minutes `tz` is ahead of UTC at instant `t`. */
function offsetMinutes(t: number, tz: string): number {
  const p = partsIn(new Date(t), tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / 60000);
}

/** The instant local midnight starts `ymd` in `tz` (DST-safe). */
export function zonedMidnight(ymd: string, tz: string): Date {
  const guess = ymdUtc(ymd);
  let t = guess - offsetMinutes(guess, tz) * 60000;
  // Re-check at the result: the offset can differ across a DST change.
  t = guess - offsetMinutes(t, tz) * 60000;
  return new Date(t);
}

/** `hour`:00 local time on `ymd`. */
export const zonedTime = (ymd: string, hour: number, tz: string) => new Date(zonedMidnight(ymd, tz).getTime() + hour * 3600000);

export interface RangeWindows {
  days: number;
  since: string;
  until: string;
  prevSince: string;
  prevUntil: string;
  l7: [string, string];
  base14: [string, string];
  l30: [string, string];
  p30: [string, string];
  /** Everything the GHL scan has to cover. */
  scanSince: string;
}

/** The chosen range (ending yesterday), the period before it, and the fatigue windows. */
export function rangeWindows(days: number, tz: string, now: Date = new Date()): RangeWindows {
  const until = addDays(localDate(now, tz), -1);
  const since = addDays(until, -(days - 1));
  const prevUntil = addDays(since, -1);
  const prevSince = addDays(prevUntil, -(days - 1));
  const l7: [string, string] = [addDays(until, -6), until];
  const base14: [string, string] = [addDays(until, -20), addDays(until, -7)];
  const l30: [string, string] = [addDays(until, -29), until];
  const p30: [string, string] = [addDays(until, -59), addDays(until, -30)];
  const scanSince = prevSince < p30[0] ? prevSince : p30[0];
  return { days, since, until, prevSince, prevUntil, l7, base14, l30, p30, scanSince };
}

/** Every date from a to b inclusive. */
export function dateList(a: string, b: string): string[] {
  const out: string[] = [];
  for (let d = a; d <= b && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** ISO week key ("2026-W46") of the local date in `tz`. */
export function weekKey(now: Date, tz: string): string {
  const ymd = localDate(now, tz);
  const t = new Date(ymdUtc(ymd));
  const day = (t.getUTCDay() + 6) % 7; // Mon = 0
  t.setUTCDate(t.getUTCDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Past Monday `hour`:00 of this ISO week in `tz`? */
export function weeklyDue(now: Date, tz: string, hour = 7): boolean {
  const p = partsIn(now, tz);
  // Tue–Sun: this ISO week's Monday has passed (Sunday ends the week).
  return p.weekday === 1 ? p.hour >= hour : true;
}

/** The next Monday `hour`:00 in `tz` after `now` (this Monday if it's still before). */
export function nextWeeklyAt(now: Date, tz: string, hour = 7): Date {
  const today = localDate(now, tz);
  const p = partsIn(now, tz);
  const daysToMonday = p.weekday === 1 ? (p.hour < hour ? 0 : 7) : (8 - p.weekday) % 7 || 7;
  return zonedTime(addDays(today, daysToMonday), hour, tz);
}

/** When to check back on a step: `days` after `from`, 08:00 local. */
export function checkBackAt(from: Date, days: number, tz: string): Date {
  return zonedTime(addDays(localDate(from, tz), Math.max(0, Math.round(days))), 8, tz);
}

/** "Nov 14" style. */
export function shortDay(ymd: string): string {
  return new Date(ymdUtc(ymd)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
