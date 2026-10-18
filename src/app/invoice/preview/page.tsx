import type { Metadata } from "next";
import { InvoicePreviewClient } from "./preview-client";

// Design preview of a redesigned client invoice / pay page, built on the
// Launch Pad visual system. Static segment — takes precedence over
// /invoice/[token]. Nothing is fetched, charged or saved.
export const metadata: Metadata = {
  title: "Invoice Preview | Nexli",
  robots: { index: false, follow: false },
};

export default function InvoicePreviewPage() {
  return <InvoicePreviewClient />;
}
