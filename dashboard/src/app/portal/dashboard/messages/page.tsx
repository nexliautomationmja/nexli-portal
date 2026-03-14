import type { Metadata } from "next";
import { PortalMessagesClient } from "./portal-messages-client";

export const metadata: Metadata = {
  title: "Messages | Nexli Client Portal",
};

export default function PortalMessagesPage() {
  return <PortalMessagesClient />;
}
