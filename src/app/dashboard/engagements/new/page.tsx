import type { Metadata } from "next";
import { EngagementComposer } from "@/components/engagements/engagement-composer";

export const metadata: Metadata = { title: "New engagement letter | Nexli Portal" };

export default function NewEngagementPage() {
  return <EngagementComposer />;
}
