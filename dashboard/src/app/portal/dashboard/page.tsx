import type { Metadata } from "next";
import { PortalOverviewClient } from "./portal-overview-client";

export const metadata: Metadata = {
  title: "Overview | Nexli Client Portal",
};

export default function PortalOverviewPage() {
  return <PortalOverviewClient />;
}
