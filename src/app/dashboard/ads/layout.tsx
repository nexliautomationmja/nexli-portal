import { auth } from "@/auth";
import { redirect } from "next/navigation";

/** The Ads command center is admin-only (Marcel and team members). */
export default async function AdsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/dashboard");
  return <>{children}</>;
}
