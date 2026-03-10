import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
