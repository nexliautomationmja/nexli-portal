import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const rn = req.nextUrl.searchParams.get("rn");

  if (!rn || !/^\d{9}$/.test(rn)) {
    return NextResponse.json({ error: "Invalid routing number" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.routingnumbers.info/api/data.json?rn=${rn}`,
      { next: { revalidate: 86400 } } // cache for 24h
    );

    if (!res.ok) {
      return NextResponse.json({ bankName: null });
    }

    const data = await res.json();

    if (data.code === 200 && data.customer_name) {
      return NextResponse.json({
        bankName: data.customer_name,
        city: data.city || null,
        state: data.state || null,
      });
    }

    return NextResponse.json({ bankName: null });
  } catch {
    return NextResponse.json({ bankName: null });
  }
}
