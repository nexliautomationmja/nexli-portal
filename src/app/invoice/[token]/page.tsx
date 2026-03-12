import type { Metadata } from "next";
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
  return <InvoiceClient token={token} />;
}
