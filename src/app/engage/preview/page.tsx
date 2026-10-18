import type { Metadata } from "next";
import { EngagePreviewClient } from "./preview-client";

// Design preview of a redesigned engagement-letter signing page, built on the
// Launch Pad visual system. Static segment — takes precedence over
// /engage/[token]. Nothing is saved: no API calls, no DB.
export const metadata: Metadata = {
  title: "Engagement Agreement Preview | Nexli",
  robots: { index: false, follow: false },
};

export default function EngagePreviewPage() {
  return <EngagePreviewClient />;
}
