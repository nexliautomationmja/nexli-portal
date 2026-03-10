import type { Metadata } from "next";
import { ContactsClient } from "./contacts-client";

export const metadata: Metadata = {
  title: "Contacts | Nexli Portal",
};

export default function ContactsPage() {
  return <ContactsClient />;
}
