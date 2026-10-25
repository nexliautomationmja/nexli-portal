import { Suspense } from "react";
import type { Metadata } from "next";
import { PortalMessagesClient } from "./portal-messages-client";

export const metadata: Metadata = {
  title: "Client Messages | Nexli",
};

export default function PortalMessagesPage() {
  // useSearchParams (?client=<email> deep links) needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <PortalMessagesClient />
    </Suspense>
  );
}
