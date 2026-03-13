import type { Metadata } from "next";
import { TaxReturnsClient } from "./tax-returns-client";

export const metadata: Metadata = {
  title: "Tax Returns | Nexli Portal",
};

export default function TaxReturnsPage() {
  return <TaxReturnsClient />;
}
