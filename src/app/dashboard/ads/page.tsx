import type { Metadata } from "next";
import { AdsCommandCenter } from "@/components/ads/ads-command-center";

export const metadata: Metadata = { title: "Ads Command Center | Nexli Portal" };

export default function AdsPage() {
  return <AdsCommandCenter />;
}
