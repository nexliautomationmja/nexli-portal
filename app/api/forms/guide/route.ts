import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const GHL_WEBHOOK_URL =
  process.env.GHL_GUIDE_WEBHOOK_URL ||
  "https://services.leadconnectorhq.com/hooks/yamjttuJWWdstfF9N0zu/webhook-trigger/c82aa21f-f433-4ccf-a379-bbab2bdf965d";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`form-guide:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    const firstName =
      typeof body.firstName === "string" ? body.firstName.trim().slice(0, 100) : "";
    const lastName =
      typeof body.lastName === "string" ? body.lastName.trim().slice(0, 100) : "";
    const email =
      typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
    const phone =
      typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const res = await fetch(GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone,
        marketingSmsOptIn: !!body.marketingSmsOptIn,
        nonMarketingSmsOptIn: !!body.nonMarketingSmsOptIn,
        source: "Free Guide Landing Page",
        guideTitle: "The 5 Automations Every Advisory Firm Needs",
      }),
    });

    if (!res.ok) {
      console.error("GHL guide webhook failed:", res.status);
      return NextResponse.json(
        { error: "Submission failed." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Guide form error:", error);
    return NextResponse.json(
      { error: "Submission failed." },
      { status: 500 }
    );
  }
}
