import type { Metadata } from "next";
import { PortalTaxOrganizerClient } from "./portal-tax-organizer-client";

export const metadata: Metadata = {
  title: "Tax Organizer | Nexli Client Portal",
};

export default function PortalTaxOrganizerPage() {
  return <PortalTaxOrganizerClient />;
}
