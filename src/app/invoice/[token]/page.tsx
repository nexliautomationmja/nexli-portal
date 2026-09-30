import type { Metadata } from "next";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOwnerBranding, NEXLI_BRANDING } from "@/lib/branding";
import { InvoiceClient } from "./invoice-client";

export const metadata: Metadata = {
  title: "Invoice | Nexli Portal",
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Resolve the issuing firm's branding server-side so the public page shows
  // the firm's logo instead of Nexli's. Any lookup failure falls back to Nexli.
  let branding = NEXLI_BRANDING;
  try {
    const [row] = await db
      .select({ ownerId: invoices.ownerId })
      .from(invoices)
      .where(eq(invoices.token, token))
      .limit(1);
    branding = await getOwnerBranding(row?.ownerId);
  } catch (err) {
    console.error("[invoice page] branding lookup failed:", err);
  }

  return <InvoiceClient token={token} branding={branding} />;
}
