import type { Metadata } from "next";
import { PortalEngagementsClient } from "./portal-engagements-client";

export const metadata: Metadata = {
  title: "Engagements | Nexli Client Portal",
};

export default function PortalEngagementsPage() {
  return <PortalEngagementsClient />;
}
