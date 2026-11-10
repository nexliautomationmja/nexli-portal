"use client";

import { useEffect } from "react";
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, PlugZap } from "lucide-react";
import {
  Button,
  ButtonLink,
  CHIP_TONE,
  Chip,
  EmptyState,
  GradientText,
  IconButton,
  List,
  Notice,
  NUM_FONT,
  PageColumn,
  PageHero,
  RainmakerCanvas,
  Section,
  Segmented,
  Skeleton,
  StatusDot,
  Surface,
} from "@/components/rainmaker";
import {
  WEEKDAYS,
  dayLabel,
  eventsByDay,
  isCancelled,
  monthCells,
  monthLabel,
  statusView,
  timeLabel,
  upcoming,
  type CalendarEvent,
  type CalendarMode,
  type CalendarState,
} from "./calendar-types";

export interface CalendarViewProps {
  state: CalendarState;
  year: number;
  month: number;
  events: CalendarEvent[];
  mode: CalendarMode;
  /** Today, passed in so the page (and fixtures) render the same every time. */
  today: { year: number; month: number; day: number; now: number };
  /** Agenda scrolls to this day of the month. */
  focusDay: number | null;
  onMode: (m: CalendarMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Show this day in the agenda. */
  onOpenDay: (day: number) => void;
  onRetry: () => void;
}

const MODES = [
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
] as const;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function MonthGrid({
  year,
  month,
  byDay,
  isToday,
  onOpenDay,
}: {
  year: number;
  month: number;
  byDay: Map<number, CalendarEvent[]>;
  isToday: (day: number) => boolean;
  onOpenDay: (day: number) => void;
}) {
  return (
    <Surface elevated className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/10">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthCells(year, month).map((day, i) => {
          const list = day ? byDay.get(day) ?? [] : [];
          const today = day ? isToday(day) : false;
          return (
            <div
              key={i}
              className={`relative min-h-[3.5rem] border-b border-r border-white/5 p-1.5 lg:min-h-[7.25rem] lg:p-2 ${
                (i + 1) % 7 === 0 ? "border-r-0" : ""
              } ${day ? "" : "bg-white/[0.015]"}`}
            >
              {day && (
                <>
                  {/* Phones: the whole cell opens the day. */}
                  {list.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenDay(day)}
                      className="absolute inset-0 lg:hidden"
                      aria-label={`${dayLabel(year, month, day)}: ${plural(list.length, "booking")}`}
                    />
                  )}
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      today ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-neutral-200"
                    }`}
                    style={NUM_FONT}
                  >
                    {day}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-0.5 px-0.5 lg:hidden" aria-hidden="true">
                    {list.slice(0, 4).map((e) => (
                      <StatusDot key={e.id} tone={statusView(e).tone} />
                    ))}
                  </div>
                  <div className="mt-1 hidden space-y-1 lg:block">
                    {list.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        className={`truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${CHIP_TONE[statusView(e).tone]} ${
                          isCancelled(e) ? "line-through opacity-70" : ""
                        }`}
                        title={`${timeLabel(e.startTime)} ${e.title || "Appointment"}`}
                      >
                        <span style={NUM_FONT}>{timeLabel(e.startTime)}</span> {e.title || "Appointment"}
                      </div>
                    ))}
                    {list.length > 3 && (
                      <button type="button" onClick={() => onOpenDay(day)} className="min-h-6 text-[10px] font-semibold text-cyan-300 hover:underline">
                        +{list.length - 3} more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

function EventRow({ e }: { e: CalendarEvent }) {
  const st = statusView(e);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-[4.5rem] shrink-0 text-xs text-neutral-200" style={NUM_FONT}>
        {timeLabel(e.startTime)}
        <div className="text-[10px] text-neutral-500">to {timeLabel(e.endTime)}</div>
      </div>
      <div className={`min-w-0 flex-1 truncate text-sm font-semibold ${isCancelled(e) ? "text-neutral-400 line-through" : "text-white"}`}>
        {e.title || "Appointment"}
      </div>
      <Chip tone={st.tone} size="xs" dot>
        {st.label}
      </Chip>
    </div>
  );
}

function Agenda({
  year,
  month,
  byDay,
  isToday,
}: {
  year: number;
  month: number;
  byDay: Map<number, CalendarEvent[]>;
  isToday: (day: number) => boolean;
}) {
  const days = [...byDay.keys()].sort((a, b) => a - b);
  if (!days.length) {
    return (
      <EmptyState
        icon={<CalendarX2 className="h-5 w-5" aria-hidden="true" />}
        title={`Nothing booked in ${monthLabel(year, month)}`}
        body="New bookings from your GoHighLevel calendars show up here."
      />
    );
  }
  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day} id={`cal-day-${day}`} className="scroll-mt-[calc(4rem+env(safe-area-inset-top))] md:scroll-mt-2">
          <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-1 flex items-center gap-2 bg-[#020617]/90 px-1 py-2 backdrop-blur md:top-0">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">{dayLabel(year, month, day)}</span>
            {isToday(day) && (
              <Chip tone="blue" size="xs">
                Today
              </Chip>
            )}
          </div>
          <List>
            {byDay.get(day)!.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </List>
        </section>
      ))}
    </div>
  );
}

function NextUp({ events }: { events: CalendarEvent[] }) {
  if (!events.length) return null;
  return (
    <Section id="next-up" eyebrow="Coming up" title="Next up">
      <List>
        {events.map((e) => {
          const d = new Date(e.startTime);
          const st = statusView(e);
          return (
            <div key={e.id} className="flex items-center gap-4 px-4 py-3">
              <div className="w-12 shrink-0 text-center">
                <div className="text-lg font-extrabold leading-none text-white" style={NUM_FONT}>
                  {d.getDate()}
                </div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {d.toLocaleDateString("en-US", { month: "short" })}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{e.title || "Appointment"}</div>
                <div className="text-xs text-neutral-400" style={NUM_FONT}>
                  {timeLabel(e.startTime)} – {timeLabel(e.endTime)}
                </div>
              </div>
              <Chip tone={st.tone} size="xs" dot>
                {st.label}
              </Chip>
            </div>
          );
        })}
      </List>
    </Section>
  );
}

export function CalendarView(p: CalendarViewProps) {
  const ready = p.state === "ready";
  const byDay = eventsByDay(p.events, p.year, p.month);
  const isToday = (day: number) => p.today.year === p.year && p.today.month === p.month && p.today.day === day;
  const isCurrent = p.today.year === p.year && p.today.month === p.month;
  const inMonth = [...byDay.values()].flat();
  const cancelled = inMonth.filter(isCancelled).length;

  // Agenda opened from a day: bring that day to the top.
  useEffect(() => {
    if (p.mode !== "agenda" || p.focusDay == null || !ready) return;
    const raf = requestAnimationFrame(() => document.getElementById(`cal-day-${p.focusDay}`)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(raf);
  }, [p.mode, p.focusDay, ready]);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented size="sm" ariaLabel="Calendar view" value={p.mode} options={MODES} onChange={p.onMode} />
      <div className="flex items-center gap-1">
        <IconButton label="Previous month" onClick={p.onPrev}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <Button variant="secondary" size="sm" onClick={p.onToday} disabled={isCurrent}>
          Today
        </Button>
        <IconButton label="Next month" onClick={p.onNext}>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );

  return (
    <RainmakerCanvas>
      <PageColumn>
        <PageHero
          pill={{ icon: <CalendarDays className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Calendar" }}
          title={
            <>
              Every booking, <GradientText>in view.</GradientText>
            </>
          }
          sub="Appointments and calls from your GoHighLevel calendars."
          meta={
            ready ? (
              <span>
                {inMonth.length ? plural(inMonth.length, "booking") : "Nothing booked"} in {monthLabel(p.year, p.month)}
                {cancelled > 0 ? ` · ${cancelled} cancelled` : ""}
              </span>
            ) : undefined
          }
        />

        <Section id="calendar" eyebrow="GoHighLevel" title={monthLabel(p.year, p.month)} right={toolbar}>
          {p.state === "disconnected" ? (
            <EmptyState
              icon={<PlugZap className="h-5 w-5" aria-hidden="true" />}
              title="Connect GoHighLevel"
              body="Add your GoHighLevel Location ID in Settings, and your bookings show up here."
              action={
                <ButtonLink href="/dashboard/settings" variant="primary" size="sm">
                  Open Settings
                </ButtonLink>
              }
            />
          ) : p.state === "error" ? (
            <Notice
              tone="error"
              title="Couldn't load your calendar"
              action={
                <Button size="sm" onClick={p.onRetry}>
                  Try again
                </Button>
              }
            >
              GoHighLevel didn&apos;t answer. Your bookings are safe there.
            </Notice>
          ) : p.state === "loading" ? (
            <Skeleton className={p.mode === "month" ? "h-[26rem] lg:h-[44rem]" : "h-64"} />
          ) : p.mode === "month" ? (
            <MonthGrid year={p.year} month={p.month} byDay={byDay} isToday={isToday} onOpenDay={p.onOpenDay} />
          ) : (
            <Agenda year={p.year} month={p.month} byDay={byDay} isToday={isToday} />
          )}
        </Section>

        {ready && p.mode === "month" && <NextUp events={upcoming(p.events, p.today.now)} />}
      </PageColumn>
    </RainmakerCanvas>
  );
}
