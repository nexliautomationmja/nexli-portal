import { auth } from "@/auth";
import { redirect } from "next/navigation";

/** Creative Studio is admin-only (Marcel and team members). */
export default async function CreativeStudioLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/dashboard");
  return <>{children}</>;
}
