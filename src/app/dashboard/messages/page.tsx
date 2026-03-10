import type { Metadata } from "next";
import { MessagesClient } from "./messages-client";

export const metadata: Metadata = {
  title: "Messages | Nexli Portal",
};

export default function MessagesPage() {
  return <MessagesClient />;
}
