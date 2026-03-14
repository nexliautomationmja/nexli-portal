import type { Metadata } from "next";
import { UploadClient } from "./upload-client";

export const metadata: Metadata = {
  title: "Upload Documents | Nexli",
};

export default async function UploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <UploadClient token={token} />;
}
