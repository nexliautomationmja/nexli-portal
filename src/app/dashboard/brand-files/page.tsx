import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BrandFilesClient } from "./brand-files-client";

export default async function BrandFilesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <BrandFilesClient
      isAdmin={session.user.role === "admin"}
      userId={session.user.id}
    />
  );
}
