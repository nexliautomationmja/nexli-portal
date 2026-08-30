import type { Metadata } from "next";
import { ClientDetailClient } from "./client-detail-client";

export const metadata: Metadata = {
  title: "Client Dashboard | Nexli Portal",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <ClientDetailClient clientId={clientId} />;
}
