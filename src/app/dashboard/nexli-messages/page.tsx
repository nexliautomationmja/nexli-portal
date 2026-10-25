import type { Metadata } from "next";
import { NexliMessagesClient } from "./nexli-messages-client";

export const metadata: Metadata = {
  title: "Nexli Team | Nexli",
};

export default function NexliMessagesPage() {
  return <NexliMessagesClient />;
}
