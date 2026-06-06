import type { Metadata } from "next";
import { AdAnalyticsClient } from "./ad-analytics-client";

export const metadata: Metadata = {
  title: "Ad Analytics | Nexli Portal",
};

export default function AdAnalyticsPage() {
  return <AdAnalyticsClient />;
}
