import type { Metadata } from "next";
import { PortalMessagesClient } from "./portal-messages-client";

export const metadata: Metadata = {
  title: "Client Messages | Nexli",
};

export default function PortalMessagesPage() {
  return <PortalMessagesClient />;
}
