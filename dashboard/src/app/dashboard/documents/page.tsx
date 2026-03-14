import type { Metadata } from "next";
import { DocumentsClient } from "./documents-client";

export const metadata: Metadata = {
  title: "Documents | Nexli Portal",
};

export default function DocumentsPage() {
  return <DocumentsClient />;
}
