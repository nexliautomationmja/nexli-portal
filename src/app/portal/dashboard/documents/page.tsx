import type { Metadata } from "next";
import { PortalDocumentsClient } from "./portal-documents-client";

export const metadata: Metadata = {
  title: "Documents | Nexli Client Portal",
};

export default function PortalDocumentsPage() {
  return <PortalDocumentsClient />;
}
