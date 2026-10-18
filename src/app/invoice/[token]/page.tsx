import type { Metadata } from "next";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOwnerBranding, NEXLI_BRANDING } from "@/lib/branding";
import { getNexliAdminId } from "@/lib/foundation-project";
import { InvoiceClient } from "./invoice-client";
import { InvoiceLaunchPadClient } from "./invoice-launch-pad-client";

export const metadata: Metadata = {
  title: "Invoice | Nexli Portal",
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Which page: invoices Nexli itself issues (owned by the Nexli admin) get
  // the Launch Pad pay page; invoices a client firm sends its own clients
  // stay on the classic page with that firm's branding. Any lookup failure
  // falls back to the classic page.
  let ownerId: string | undefined;
  let isNexliInvoice = false;
  try {
    const [row] = await db
      .select({ ownerId: invoices.ownerId })
      .from(invoices)
      .where(eq(invoices.token, token))
      .limit(1);
    ownerId = row?.ownerId;
    if (ownerId) {
      const nexliAdminId = await getNexliAdminId();
      isNexliInvoice = Boolean(nexliAdminId) && ownerId === nexliAdminId;
    }
  } catch (err) {
    console.error("[invoice page] invoice lookup failed:", err);
  }

  if (isNexliInvoice) return <InvoiceLaunchPadClient token={token} />;

  // Classic page: resolve the issuing firm's branding server-side so the
  // public page shows the firm's logo instead of Nexli's. Any lookup failure
  // falls back to Nexli.
  let branding = NEXLI_BRANDING;
  try {
    branding = await getOwnerBranding(ownerId);
  } catch (err) {
    console.error("[invoice page] branding lookup failed:", err);
  }

  return <InvoiceClient token={token} branding={branding} />;
}
