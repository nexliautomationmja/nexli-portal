import type { Metadata } from "next";
import { TaxOrganizerClient } from "./tax-organizer-client";

export const metadata: Metadata = {
  title: "Tax Organizer | Nexli",
};

export default async function TaxOrganizerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TaxOrganizerClient token={token} />;
}
