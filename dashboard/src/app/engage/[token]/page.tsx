import type { Metadata } from "next";
import { EngageClient } from "./engage-client";

export const metadata: Metadata = {
  title: "Engagement Letter | Nexli Portal",
};

export default async function EngagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <EngageClient token={token} />;
}
