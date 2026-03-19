import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listStripeProducts } from "@/lib/stripe";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const products = await listStripeProducts();
    return NextResponse.json({ products });
  } catch (err) {
    console.error("Failed to fetch Stripe products:", err);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
