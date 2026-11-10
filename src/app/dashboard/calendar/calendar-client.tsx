"use client";

import { useEffect, useState } from "react";
import { useMediaQuery } from "@/lib/use-media";
import { CalendarView } from "./calendar-view";
import { calendarUrl, stateOf, type CalendarMode, type CalendarResponse } from "./calendar-types";

/** GoHighLevel bookings by month: loads them; CalendarView draws the page. */
export function CalendarClient() {
  const [today] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), now: d.getTime() };
  });
  const [cursor, setCursor] = useState({ year: today.year, month: today.month });
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<{ key: string; data: CalendarResponse | null; failed: boolean } | null>(null);
  // The month grid needs room; phones start on the agenda. Choosing one sticks.
  const wide = useMediaQuery("(min-width: 1024px)");
  const [chosen, setChosen] = useState<CalendarMode | null>(null);
  const [focusDay, setFocusDay] = useState<number | null>(null);
  const mode: CalendarMode = chosen ?? (wide ? "month" : "agenda");

  const { year, month } = cursor;
  const key = `${year}-${month}-${tick}`;
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(calendarUrl(year, month), { signal: ctrl.signal })
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as CalendarResponse | null;
        if (!r.ok || !data) throw new Error(String(r.status));
        setResult({ key, data, failed: false });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ key, data: null, failed: true });
      });
    return () => ctrl.abort();
  }, [key, year, month]);

  // Only this month's answer counts (a slow earlier month is ignored).
  const current = result?.key === key ? result : null;
  const go = (delta: number) => {
    setFocusDay(null);
    setCursor(({ year: y, month: m }) => {
      const d = new Date(y, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <CalendarView
      state={current ? stateOf(current.data, current.failed) : "loading"}
      year={year}
      month={month}
      events={current?.data?.events ?? []}
      mode={mode}
      today={today}
      focusDay={focusDay}
      onMode={(m) => {
        setChosen(m);
        setFocusDay(null);
      }}
      onPrev={() => go(-1)}
      onNext={() => go(1)}
      onToday={() => {
        setFocusDay(null);
        setCursor({ year: today.year, month: today.month });
      }}
      onOpenDay={(day) => {
        setChosen("agenda");
        setFocusDay(day);
      }}
      onRetry={() => setTick((t) => t + 1)}
    />
  );
}
