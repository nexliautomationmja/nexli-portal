import { redirect } from "next/navigation";

/** Old link (before studios): the Ad copy tool now lives in each studio — this one was Nexli's. */
export default function OldAdCopyPage() {
  redirect("/dashboard/creative-studio/s/nexli/ad-copy");
}
