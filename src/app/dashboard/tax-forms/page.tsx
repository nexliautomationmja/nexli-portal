import type { Metadata } from "next";
import { TaxFormsClient } from "./tax-forms-client";

export const metadata: Metadata = {
  title: "Tax Center | Nexli Portal",
};

export default function TaxFormsPage() {
  return <TaxFormsClient />;
}
