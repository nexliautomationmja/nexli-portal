import type { Metadata } from "next";
import { LinksClient } from "./links-client";

export const metadata: Metadata = {
  title: "Secure Links | Nexli Portal",
};

export default function LinksPage() {
  return <LinksClient />;
}
