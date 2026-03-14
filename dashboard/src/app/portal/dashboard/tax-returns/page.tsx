import type { Metadata } from "next";
import { PortalTaxReturnsClient } from "./portal-tax-returns-client";

export const metadata: Metadata = {
  title: "Tax Returns | Nexli Client Portal",
};

export default function PortalTaxReturnsPage() {
  return <PortalTaxReturnsClient />;
}
