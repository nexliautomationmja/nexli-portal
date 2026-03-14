import type { Metadata } from "next";
import { PortalInvoicesClient } from "./portal-invoices-client";

export const metadata: Metadata = {
  title: "Invoices | Nexli Client Portal",
};

export default function PortalInvoicesPage() {
  return <PortalInvoicesClient />;
}
