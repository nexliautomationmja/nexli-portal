import type { Metadata } from "next";
import { CalendarClient } from "./calendar-client";

export const metadata: Metadata = {
  title: "Calendar | Nexli Portal",
};

export default function CalendarPage() {
  return <CalendarClient />;
}
