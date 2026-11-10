"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "./feedback";
import { Surface } from "./surfaces";
import { BIG_NUM, ICON_TONE, NUM_FONT, TEXT_TONE, labelCls, type Tone } from "./tokens";

// ─── KPI tiles ─────────────────────────────────────────────

/**
 * A number with its label. `hero` = the section's headline metric (tinted, spans
 * two columns), `md` = standard, `sm` = dense rows. `tone` colors the figure
 * (green = good, red = needs action…); `sub` says what it means in words.
 */
export function KpiTile({
  label,
  value,
  size = "md",
  tone = "neutral",
  sub,
  chip,
  footer,
  href,
  icon,
  loading = false,
  className = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  size?: "hero" | "md" | "sm";
  tone?: Tone;
  sub?: React.ReactNode;
  chip?: React.ReactNode;
  footer?: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const hero = size === "hero";
  const shell = hero
    ? "col-span-2 rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-blue-600/[0.16] via-[#0b1220] to-cyan-500/[0.08] p-4 sm:p-5"
    : `rounded-2xl border border-white/10 bg-white/[0.04] ${size === "sm" ? "p-3" : "p-4"}`;
  const valueCls = hero ? "text-4xl sm:text-5xl" : size === "sm" ? "text-lg" : "text-2xl";
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={`${labelCls} truncate`}>{label}</div>
        {icon && <span className="-mt-1 shrink-0">{icon}</span>}
      </div>
      <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
        {loading ? (
          <Skeleton className={`${hero ? "h-10 w-40 sm:h-12" : size === "sm" ? "h-5 w-16" : "h-7 w-24"} rounded-lg`} />
        ) : (
          <div className={`font-extrabold leading-none ${TEXT_TONE[tone]} ${valueCls}`} style={BIG_NUM}>
            {value}
          </div>
        )}
        {chip}
      </div>
      {sub && <div className={`${hero ? "mt-2 text-xs" : "mt-2 text-[11px]"} text-neutral-400`}>{sub}</div>}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </>
  );
  const cls = `flex min-w-0 flex-col ${shell} ${className}`;
  return href ? (
    <Link href={href} className={`${cls} group transition-all hover:-translate-y-0.5 hover:border-cyan-400/30 motion-reduce:hover:translate-y-0`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Tile grid: 2 columns on phones, 3 or 4 from lg. */
export function KpiGrid({ cols = 4, className = "", children }: { cols?: 3 | 4; className?: string; children: React.ReactNode }) {
  return <div className={`grid grid-cols-2 gap-3 ${cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"} ${className}`}>{children}</div>;
}

/** Small label/value pair for cards and dense rows. */
export function MiniStat({ label, value, tone = "neutral", sub }: { label: React.ReactNode; value: React.ReactNode; tone?: Tone; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-bold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-bold ${TEXT_TONE[tone]}`} style={NUM_FONT}>
        {value}
      </div>
      {sub && <div className="truncate text-[10px] text-neutral-400">{sub}</div>}
    </div>
  );
}

// ─── Data table: a real table on wide screens, cards below ──

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  /** Keep this column visible while the rest scroll sideways (use on the first column). */
  sticky?: boolean;
  className?: string;
};

const BREAK = {
  md: { table: "hidden md:block", cards: "md:hidden" },
  lg: { table: "hidden lg:block", cards: "lg:hidden" },
} as const;
const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

/**
 * Rows of records. From the breakpoint up: a table (first column sticky when it
 * scrolls). Below: one card per row from `card`. Put a real <Link> in the
 * primary cell; `onRowClick` is only a mouse convenience for the rest of the row.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  card,
  caption,
  onRowClick,
  breakpoint = "lg",
  minWidth,
  loading = false,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  card: (row: T) => React.ReactNode;
  caption: string;
  onRowClick?: (row: T) => void;
  breakpoint?: keyof typeof BREAK;
  minWidth?: number;
  loading?: boolean;
  empty?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label={`Loading ${caption}`}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }
  if (!rows.length && empty) return <>{empty}</>;
  const b = BREAK[breakpoint];
  return (
    <>
      <Surface elevated className={`cs-scroll overflow-x-auto ${b.table}`}>
        <table className="w-full border-separate border-spacing-0 text-xs" style={{ ...NUM_FONT, minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`border-b border-white/10 px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400 first:pl-4 last:pr-4 ${ALIGN[c.align ?? "left"]} ${
                    c.sticky ? "sticky left-0 z-10 bg-[#0b1220]" : ""
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`group transition-colors hover:bg-white/[0.025] ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-b border-white/5 px-3 py-3.5 align-middle text-neutral-200 first:pl-4 last:pr-4 group-last:border-b-0 ${ALIGN[c.align ?? "left"]} ${
                      c.sticky ? "sticky left-0 z-10 bg-[#0b1220] group-hover:bg-[#0f1729]" : ""
                    } ${c.className ?? ""}`}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
      <ul className={`space-y-2 ${b.cards}`} aria-label={caption}>
        {rows.map((r) => (
          <li key={rowKey(r)}>
            <Surface className="p-3.5">{card(r)}</Surface>
          </li>
        ))}
      </ul>
    </>
  );
}

// ─── Lists ─────────────────────────────────────────────────

export function List({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <Surface className={`divide-y divide-white/5 overflow-hidden ${className}`}>{children}</Surface>;
}

/** One line in a List: icon tile, title + sub, and a right-hand value. Becomes a link with `href`. */
export function ListRow({
  icon,
  tone = "neutral",
  title,
  sub,
  right,
  href,
  external = false,
}: {
  icon?: React.ReactNode;
  tone?: Tone;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      {icon && <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${ICON_TONE[tone]}`}>{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{title}</div>
        {sub && <div className="truncate text-xs text-neutral-400">{sub}</div>}
      </div>
      {right && (
        <div className="shrink-0 text-right text-xs text-neutral-400" style={NUM_FONT}>
          {right}
        </div>
      )}
      {href && <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
    </>
  );
  const cls = "group flex min-h-14 items-center gap-3 px-4 py-3";
  if (!href) return <div className={cls}>{body}</div>;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} transition-colors hover:bg-white/[0.03]`}>
      {body}
    </a>
  ) : (
    <Link href={href} className={`${cls} transition-colors hover:bg-white/[0.03]`}>
      {body}
    </Link>
  );
}
