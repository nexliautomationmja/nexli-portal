import { redirect } from "next/navigation";

export default async function ClientDetailRedirect({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  redirect(`/dashboard/admin?client=${clientId}`);
}
