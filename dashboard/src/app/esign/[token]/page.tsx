import type { Metadata } from "next";
import { EsignClient } from "./esign-client";

export const metadata: Metadata = {
  title: "Sign Document | Nexli Portal",
};

export default async function EsignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <EsignClient token={token} />;
}
