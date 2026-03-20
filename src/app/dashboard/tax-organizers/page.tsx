import type { Metadata } from "next";
import { TaxOrganizersClient } from "./tax-organizers-client";

export const metadata: Metadata = {
  title: "Tax Organizers | Nexli Portal",
};

export default function TaxOrganizersPage() {
  return <TaxOrganizersClient />;
}
