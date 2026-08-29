import type { Metadata } from "next";
import { ClientTrackerClient } from "./client-tracker-client";

export const metadata: Metadata = {
  title: "Client Tracker | Nexli Portal",
};

export default function ClientTrackerPage() {
  return <ClientTrackerClient />;
}
