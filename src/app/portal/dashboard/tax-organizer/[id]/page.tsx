import type { Metadata } from "next";
import { OrganizerFormClient } from "./organizer-form-client";

export const metadata: Metadata = {
  title: "Tax Organizer | Nexli Client Portal",
};

export default function OrganizerFormPage() {
  return <OrganizerFormClient />;
}
