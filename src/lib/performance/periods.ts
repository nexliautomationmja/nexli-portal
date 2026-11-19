/**
 * Billing months of an engagement on the Nov 19 2026 pricing (pure,
 * client-safe). The letter's Section 3(c): "Month" means each one-month
 * period of the Agreement, the first beginning on the date of last signature
 * and each later one on the same day of the following calendar month (or on
 * the last day of that month, where it has no such day). Performance Pay is
 * worked out per Month, so every Month has exactly one Agency Fee to credit.
 *
 * Everything is UTC. `end` is exclusive.
 */

/** `anchor` moved by whole months, the day clamped to the target month's last day (Jan 31 + 1 → Feb 28/29). */
export function addMonthsUtc(anchor: Date, months: number): Date {
  const m = anchor.getUTCMonth() + months;
  const y = anchor.getUTCFullYear() + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(y, mm, Math.min(anchor.getUTCDate(), lastDay), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds())
  );
}

export interface MonthRange {
  /** 1 = the Month that begins at signing. */
  index: number;
  start: Date;
  /** Exclusive: the start of the next Month. */
  end: Date;
}

/** Month `index` (1-based). Each start is counted from the signing date itself, so clamping never drifts. */
export function monthRange(termStart: Date, index: number): MonthRange {
  return { index, start: addMonthsUtc(termStart, index - 1), end: addMonthsUtc(termStart, index) };
}

/** The index of the Month containing `at` (1-based); 0 when `at` is before signing. */
export function monthIndexAt(termStart: Date, at: Date): number {
  if (at.getTime() < termStart.getTime()) return 0;
  // Start from a calendar-month estimate, then settle (at most one step either way).
  let i = (at.getUTCFullYear() - termStart.getUTCFullYear()) * 12 + (at.getUTCMonth() - termStart.getUTCMonth()) + 1;
  if (i < 1) i = 1;
  while (i > 1 && monthRange(termStart, i).start.getTime() > at.getTime()) i--;
  while (monthRange(termStart, i).end.getTime() <= at.getTime()) i++;
  return i;
}

/**
 * Every Month that has fully ended by `now`, oldest first. With `endsAt` (a
 * recorded non-renewal), Months that would begin at or after it are left
 * out: the last Month of the agreement is the last one listed.
 */
export function closedMonths(termStart: Date, now: Date, endsAt?: Date | null, max = 240): MonthRange[] {
  const out: MonthRange[] = [];
  for (let i = 1; i <= max; i++) {
    const r = monthRange(termStart, i);
    if (r.end.getTime() > now.getTime()) break;
    if (endsAt && r.start.getTime() >= endsAt.getTime()) break;
    out.push(r);
  }
  return out;
}

/** YYYY-MM-DD (UTC). */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 19 – Dec 18, 2026" / "Dec 19, 2026 – Jan 18, 2027": first and last day of the Month. */
export function periodLabel(range: { start: Date; end: Date }): string {
  const last = new Date(range.end.getTime() - 24 * 60 * 60 * 1000);
  const day = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const sameYear = range.start.getUTCFullYear() === last.getUTCFullYear();
  return sameYear
    ? `${day(range.start)} – ${day(last)}, ${last.getUTCFullYear()}`
    : `${day(range.start)}, ${range.start.getUTCFullYear()} – ${day(last)}, ${last.getUTCFullYear()}`;
}
